from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Optional
import json
import logging

from app.schemas.inference import (
    CreateInferenceTaskRequest,
    CreateInferenceTaskResponse,
    InferenceTaskStatusResponse,
    InferenceResultsResponse,
    InferenceResultItem,
    InferenceTaskStatus
)
from app.services.inference_service import InferenceService
from app.api.auth import get_current_user_optional, get_user_and_token

router = APIRouter(prefix="/inference_tasks", tags=["inference"])
logger = logging.getLogger(__name__)

# Instance globale du service d'inférence
inference_service = InferenceService()

@router.post("", response_model=CreateInferenceTaskResponse)
async def create_inference_task(
    request: CreateInferenceTaskRequest,
    user_and_token: tuple = Depends(get_user_and_token)
):
    """Créer une nouvelle tâche d'inférence VTO"""
    current_user, jwt_token = user_and_token
    
    if not current_user or not jwt_token:
        raise HTTPException(status_code=401, detail="Authentication requise")
    
    user_id = current_user.get("sub") or current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="ID utilisateur introuvable")
    
    try:
        task_id, status = await inference_service.create_inference_task(user_id, request, jwt_token)
        logger.info(f"Tâche d'inférence créée: {task_id} pour l'utilisateur {user_id}")
        logger.info(f"Nombre de vêtements: {request.cloth_image_urls}")
        
        return CreateInferenceTaskResponse(
            task_id=task_id,
            status=InferenceTaskStatus.IN_QUEUE,
            message=f"Tâche d'inférence créée pour {len(request.cloth_image_urls)} vêtement(s)",
            cloth_count=len(request.cloth_image_urls)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erreur lors de la création de tâche d'inférence: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")

@router.get("/{task_id}/status", response_model=InferenceTaskStatusResponse)
async def get_task_status(
    task_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Récupérer le statut d'une tâche d'inférence"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication requise")
    
    user_id = current_user.get("sub") or current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="ID utilisateur introuvable")
    
    try:
        task_data = await inference_service.get_task_status(task_id, user_id)
        if not task_data:
            raise HTTPException(status_code=404, detail="Tâche introuvable")
        
        # Compter les résultats s'ils existent
        results_count = 0
        if task_data.get('output'):
            try:
                output_data = json.loads(task_data['output'])
                if 'result_s3_key' in output_data:
                    results_count = 1
            except:
                pass
        
        return InferenceTaskStatusResponse(
            task_id=task_id,
            status=InferenceTaskStatus(task_data['status']),
            progress=task_data.get('progress', 0.0),
            message=_get_status_message(task_data['status'], task_data.get('progress', 0.0)),
            results_count=results_count,
            error_message=task_data.get('error_message')
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la récupération du statut: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")

@router.get("/{task_id}/results", response_model=InferenceResultsResponse)
async def get_task_results(
    task_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Récupérer les résultats d'une tâche d'inférence"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication requise")
    
    user_id = current_user.get("sub") or current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="ID utilisateur introuvable")
    
    try:
        task_data = await inference_service.get_task_status(task_id, user_id)
        if not task_data:
            raise HTTPException(status_code=404, detail="Tâche introuvable")
        
        # Vérifier si la tâche est terminée
        if task_data['status'] != InferenceTaskStatus.COMPLETED.value:
            raise HTTPException(status_code=425, detail="Tâche non terminée")
        
        # Extraire les résultats
        results = []
        successful_results = 0
        failed_results = 0
        
        if task_data.get('output'):
            try:
                output_data = json.loads(task_data['output'])
                result_s3_key = output_data.get('result_s3_key')
                
                if result_s3_key:
                    # Générer l'URL signée
                    signed_url = await inference_service.generate_signed_url(result_s3_key)
                    
                    results.append(InferenceResultItem(
                        cloth_s3_key=task_data['cloth_s3_key'],
                        result_s3_key=result_s3_key,
                        result_signed_url=signed_url,
                        status='success'
                    ))
                    successful_results = 1
                else:
                    results.append(InferenceResultItem(
                        cloth_s3_key=task_data['cloth_s3_key'],
                        status='failed',
                        error='Aucun résultat disponible'
                    ))
                    failed_results = 1
            except Exception as e:
                logger.error(f"Erreur lors du parsing des résultats: {str(e)}")
                results.append(InferenceResultItem(
                    cloth_s3_key=task_data['cloth_s3_key'],
                    status='failed',
                    error=str(e)
                ))
                failed_results = 1
        
        return InferenceResultsResponse(
            task_id=task_id,
            status=InferenceTaskStatus(task_data['status']),
            results=results,
            total_results=len(results),
            successful_results=successful_results,
            failed_results=failed_results
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des résultats: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")

@router.post("/webhook")
async def runpod_webhook(request: Request):
    """Endpoint webhook pour recevoir les callbacks de Runpod"""
    try:
        # Récupérer le payload JSON
        payload = await request.json()
        
        # Valider les champs requis
        job_id = payload.get('job_id') or payload.get('id')
        if not job_id:
            raise HTTPException(status_code=400, detail="job_id manquant")
        
        # Enregistrer le webhook dans les logs
        logger.info(f"Webhook reçu pour job_id: {job_id}, status: {payload.get('status')}")
        
        # Traiter le webhook
        await inference_service.handle_webhook(job_id, payload)
        
        return {"status": "success", "message": "Webhook traité"}
        
    except json.JSONDecodeError:
        logger.error("Payload webhook JSON invalide")
        raise HTTPException(status_code=400, detail="JSON invalide")
    except Exception as e:
        logger.error(f"Erreur lors du traitement du webhook: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")

@router.get("/{task_id}/signed-url")
async def get_result_signed_url(
    task_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Générer une URL signée pour le résultat d'une tâche"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication requise")
    
    user_id = current_user.get("sub") or current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="ID utilisateur introuvable")
    
    try:
        task_data = await inference_service.get_task_status(task_id, user_id)
        if not task_data:
            raise HTTPException(status_code=404, detail="Tâche introuvable")
        
        if task_data['status'] != InferenceTaskStatus.COMPLETED.value:
            raise HTTPException(status_code=425, detail="Tâche non terminée")
        
        if not task_data.get('output'):
            raise HTTPException(status_code=404, detail="Aucun résultat disponible")
        
        try:
            output_data = json.loads(task_data['output'])
            result_s3_key = output_data.get('result_s3_key')
            
            if not result_s3_key:
                raise HTTPException(status_code=404, detail="Clé S3 du résultat introuvable")
            
            signed_url = await inference_service.generate_signed_url(result_s3_key)
            
            return {
                "signed_url": signed_url,
                "s3_key": result_s3_key,
                "expires_in": 3600
            }
            
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Données de sortie corrompues")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la génération de l'URL signée: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")

def _get_status_message(status: str, progress: float) -> str:
    """Générer un message de statut basé sur le statut et le progress"""
    if status == InferenceTaskStatus.IN_QUEUE.value:
        return "Tâche en attente de traitement"
    elif status == InferenceTaskStatus.IN_PROGRESS.value:
        if progress < 30:
            return "Préparation des images..."
        elif progress < 60:
            return "Envoi à Runpod..."
        elif progress < 90:
            return "Traitement en cours..."
        else:
            return "Finalisation..."
    elif status == InferenceTaskStatus.COMPLETED.value:
        return "Traitement terminé avec succès"
    elif status == InferenceTaskStatus.FAILED.value:
        return "Échec du traitement"
    elif status == InferenceTaskStatus.CANCELLED.value:
        return "Traitement annulé"
    else:
        return f"Statut: {status}"