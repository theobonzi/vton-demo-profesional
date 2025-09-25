from fastapi import APIRouter, Depends, HTTPException, Request, Response
from typing import Optional, Dict
import json
import logging
import random
import math
import time
from collections import defaultdict, deque
import hmac
import hashlib
from urllib.parse import parse_qs

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
from app.config import settings
from app.services.metrics_service import metrics_service, track_webhook_processing_time

router = APIRouter(prefix="/inference_tasks", tags=["inference"])
logger = logging.getLogger(__name__)

# Instance globale du service d'inférence
inference_service = InferenceService()

# Rate limiter simple en mémoire pour /status (utilisateur + endpoint)
# Structure : {user_id: deque([timestamp1, timestamp2, ...])}
_rate_limit_cache: Dict[str, deque] = defaultdict(lambda: deque())
_RATE_LIMIT_STATUS = 20  # Max 20 requests par minute par utilisateur
_RATE_LIMIT_WINDOW = 60  # Fenêtre de 60 secondes

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
        
        # Métriques Prometheus
        metrics_service.record_task_created(task_id, user_id)
        
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
    current_user: Optional[dict] = Depends(get_current_user_optional),
    response: Response = None
):
    """Récupérer le statut d'une tâche d'inférence avec optimisation polling"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication requise")
    
    user_id = current_user.get("sub") or current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="ID utilisateur introuvable")
    
    # Vérification rate limiting pour éviter le spam de polling
    if not _check_rate_limit(user_id, _RATE_LIMIT_STATUS, _RATE_LIMIT_WINDOW):
        # Métriques : enregistrer le hit de rate limiting
        metrics_service.record_rate_limit_hit("status", user_id)
        raise HTTPException(
            status_code=429, 
            detail="Trop de requêtes de statut. Veuillez respecter l'intervalle de polling recommandé.",
            headers={"Retry-After": "5"}
        )
    
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
        
        # Optimisation polling : ajouter headers de contrôle
        status = InferenceTaskStatus(task_data['status'])
        _add_polling_headers(response, status, task_data.get('progress', 0.0))
        
        # Métriques : enregistrer la requête de polling
        metrics_service.record_polling_request(user_id, status.value)
        
        return InferenceTaskStatusResponse(
            task_id=task_id,
            status=status,
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
@track_webhook_processing_time
async def runpod_webhook(request: Request):
    """Endpoint webhook pour recevoir les callbacks de Runpod avec sécurité renforcée"""
    try:
        # Récupération des headers et validation de sécurité
        raw_body = await request.body()
        headers = request.headers
        
        # Vérification HMAC si secret configuré
        if settings.runpod_webhook_secret:
            if not _verify_webhook_signature(raw_body, headers, settings.runpod_webhook_secret):
                logger.warning(f"Webhook avec signature HMAC invalide depuis IP: {request.client.host}")
                raise HTTPException(status_code=401, detail="Signature webhook invalide")
        
        # Vérification token de base via query parameter
        token = request.query_params.get('token')
        if settings.runpod_webhook_secret and not token:
            raise HTTPException(status_code=401, detail="Token webhook requis")
        
        # Parser le payload JSON
        try:
            payload = json.loads(raw_body.decode('utf-8'))
        except (UnicodeDecodeError, json.JSONDecodeError):
            logger.error("Payload webhook JSON invalide")
            raise HTTPException(status_code=400, detail="JSON invalide")
        
        # Valider les champs requis
        job_id = payload.get('job_id') or payload.get('id')
        if not job_id:
            raise HTTPException(status_code=400, detail="job_id manquant")
        
        # Protection contre les doublons (idempotence)
        if not await _check_webhook_idempotence(job_id, payload):
            logger.info(f"Webhook déjà traité pour job_id: {job_id}")
            return {"status": "success", "message": "Webhook déjà traité (idempotent)"}
        
        # Enregistrer le webhook dans les logs avec métadonnées de sécurité
        logger.info(f"Webhook authentifié reçu - job_id: {job_id}, status: {payload.get('status')}, IP: {request.client.host}")
        
        # Métriques : enregistrer la réception du webhook
        metrics_service.record_webhook_received(job_id, "received", payload.get('status', 'unknown'))
        
        # Traiter le webhook
        await inference_service.handle_webhook(job_id, payload)
        
        return {"status": "success", "message": "Webhook traité"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors du traitement du webhook: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")

@router.get("/{task_id}/debug")
async def debug_inference_task(
    task_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Endpoint de diagnostic pour une tâche d'inférence"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication requise")
    
    user_id = current_user.get("sub") or current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="ID utilisateur introuvable")

    try:
        from app.services.supabase_service import SupabaseService
        supabase_service = SupabaseService()
        
        # Récupérer la tâche principale
        task_result = supabase_service.client.table('inference_task').select('*').eq('id', task_id).eq('user_id', user_id).execute()
        
        if not task_result.data:
            raise HTTPException(status_code=404, detail="Tâche introuvable")
        
        task = task_result.data[0]
        
        # Récupérer les événements
        events_result = supabase_service.client.table('inference_task_event').select('*').eq('inference_task_id', task_id).order('created_at').execute()
        
        # Récupérer les webhooks si job_id existe
        webhooks = []
        if task.get('job_id'):
            webhooks_result = supabase_service.client.table('webhook_delivery').select('*').eq('job_id', task['job_id']).order('created_at').execute()
            webhooks = webhooks_result.data or []
        
        return {
            "task": task,
            "events": events_result.data or [],
            "webhooks": webhooks,
            "diagnostics": {
                "has_job_id": bool(task.get('job_id')),
                "has_output": bool(task.get('output')),
                "events_count": len(events_result.data or []),
                "webhooks_count": len(webhooks),
                "webhook_url": f"{settings.public_base_url}/api/v1/inference_tasks/webhook",
                "s3_configured": bool(settings.s3_bucket_name and settings.aws_access_key_id),
                "runpod_configured": bool(settings.runpod_api_token and settings.runpod_vto_endpoint)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors du diagnostic: {str(e)}")
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

def _add_polling_headers(response: Response, status: InferenceTaskStatus, progress: float):
    """Ajouter les headers d'optimisation polling selon votre brief"""
    if status in [InferenceTaskStatus.COMPLETED, InferenceTaskStatus.FAILED, InferenceTaskStatus.CANCELLED]:
        # Statut final : pas de polling nécessaire
        response.headers["X-Poll-Stop"] = "true"
        response.headers["Cache-Control"] = "max-age=300"  # Cache 5min pour résultats finaux
        return
    
    # Calcul intervalle avec backoff exponentiel + jitter
    if status == InferenceTaskStatus.IN_QUEUE:
        base_interval = 2  # 2s de base pour queue
        max_interval = 10
    elif status == InferenceTaskStatus.IN_PROGRESS:
        if progress < 30:
            base_interval = 3  # 3s pour préparation
            max_interval = 8
        elif progress < 70:
            base_interval = 5  # 5s pour traitement
            max_interval = 15
        else:
            base_interval = 2  # 2s pour finalisation
            max_interval = 8
    else:
        base_interval = 5
        max_interval = 30
    
    # Appliquer jitter ±20%
    jitter = random.uniform(0.8, 1.2)
    recommended_interval = min(base_interval * jitter, max_interval)
    
    # Headers de contrôle polling
    response.headers["X-Poll-Interval"] = str(int(recommended_interval))
    response.headers["X-Poll-Max-Attempts"] = "30"  # Max 30 tentatives
    response.headers["X-Poll-Timeout"] = "300"      # Timeout total 5min
    response.headers["Cache-Control"] = "no-cache, must-revalidate"
    
    # Header spécifique si progression rapide
    if status == InferenceTaskStatus.IN_PROGRESS and progress > 80:
        response.headers["X-Poll-Priority"] = "high"

def _check_rate_limit(user_id: str, max_requests: int, window_seconds: int) -> bool:
    """Vérifier le rate limiting pour un utilisateur"""
    now = time.time()
    user_requests = _rate_limit_cache[user_id]
    
    # Nettoyer les requêtes anciennes (hors de la fenêtre)
    while user_requests and user_requests[0] <= now - window_seconds:
        user_requests.popleft()
    
    # Vérifier si limite atteinte
    if len(user_requests) >= max_requests:
        logger.warning(f"Rate limit dépassé pour utilisateur {user_id}: {len(user_requests)}/{max_requests}")
        return False
    
    # Enregistrer cette requête
    user_requests.append(now)
    return True

def _verify_webhook_signature(body: bytes, headers: dict, secret: str) -> bool:
    """Vérifier la signature HMAC du webhook RunPod"""
    # Chercher la signature dans plusieurs formats possibles
    signature_header = headers.get('x-runpod-signature') or headers.get('x-signature') or headers.get('authorization')
    
    if not signature_header:
        logger.warning("Aucune signature trouvée dans les headers webhook")
        return False
    
    try:
        # Format GitHub-style: sha256=<hash>
        if signature_header.startswith('sha256='):
            expected_signature = signature_header[7:]
        else:
            expected_signature = signature_header.replace('Bearer ', '')
        
        # Calculer la signature attendue
        computed_signature = hmac.new(
            secret.encode('utf-8'),
            body,
            hashlib.sha256
        ).hexdigest()
        
        # Comparaison sécurisée pour éviter les attaques timing
        return hmac.compare_digest(computed_signature, expected_signature)
        
    except Exception as e:
        logger.error(f"Erreur lors de la vérification de signature webhook: {str(e)}")
        return False

# Cache simple pour l'idempotence des webhooks (job_id -> timestamp)
_webhook_processed_cache: Dict[str, float] = {}
_WEBHOOK_CACHE_TTL = 3600  # 1 heure

async def _check_webhook_idempotence(job_id: str, payload: dict) -> bool:
    """Vérifier si ce webhook n'a pas déjà été traité (idempotence)"""
    try:
        now = time.time()
        
        # Nettoyer le cache des entrées anciennes
        expired_keys = [k for k, v in _webhook_processed_cache.items() if now - v > _WEBHOOK_CACHE_TTL]
        for key in expired_keys:
            del _webhook_processed_cache[key]
        
        # Vérifier si déjà traité
        cache_key = f"{job_id}:{payload.get('status', 'unknown')}"
        if cache_key in _webhook_processed_cache:
            return False  # Déjà traité
        
        # Vérifier aussi en base de données (niveau webhook_delivery)
        from app.services.supabase_service import SupabaseService
        supabase_service = SupabaseService()
        
        existing_webhooks = supabase_service.client.table('webhook_delivery').select('id').eq('job_id', job_id).eq('processed', True).execute()
        
        if existing_webhooks.data:
            logger.info(f"Webhook {job_id} déjà traité selon la base de données")
            # Marquer dans le cache pour éviter les requêtes futures
            _webhook_processed_cache[cache_key] = now
            return False
        
        # Marquer comme en cours de traitement
        _webhook_processed_cache[cache_key] = now
        return True
        
    except Exception as e:
        logger.error(f"Erreur lors de la vérification d'idempotence webhook: {str(e)}")
        # En cas d'erreur, on laisse passer pour éviter de bloquer les webhooks légitimes
        return True