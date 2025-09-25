"""
API RunPod simplifiée - 2 endpoints seulement
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
import logging
from pydantic import BaseModel, Field
from typing import Dict, Any, List

from app.api.auth import get_current_user_optional
from app.services.runpod_service import runpod_service
from app.services.metrics_service import metrics_service
from app.config import settings
import boto3
import base64
import uuid
from datetime import datetime

router = APIRouter(prefix="/runpod", tags=["runpod"])
logger = logging.getLogger(__name__)

# Schémas Pydantic
class RunJobRequest(BaseModel):
    """Demande de création de job RunPod"""
    # Images (choix entre URLs ou base64)
    cloth_image_urls: Optional[List[str]] = Field(None, description="URLs des vêtements")
    cloth_images: Optional[List[str]] = Field(None, description="Images base64 des vêtements")
    
    # Avatar (optionnel - récupéré de la DB si non fourni)
    person_image_data: Optional[str] = Field(None, description="Image personne base64")
    mask_image_data: Optional[str] = Field(None, description="Masque base64")
    person_s3_key: Optional[str] = Field(None, description="Clé S3 personne")
    mask_s3_key: Optional[str] = Field(None, description="Clé S3 masque")
    
    # Paramètres
    steps: int = Field(default=50, ge=1, le=100)
    guidance_scale: float = Field(default=2.5, ge=0.1, le=20.0)

class RunJobResponse(BaseModel):
    """Réponse de création de job"""
    job_id: str
    status: str
    message: str

class JobStatusResponse(BaseModel):
    """Réponse de statut de job"""
    job_id: str
    status: str  # IN_PROGRESS, COMPLETED, FAILED, etc.
    output: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    result_url: Optional[str] = None  # URL persistée si COMPLETED

@router.post("/run", response_model=RunJobResponse)
async def create_runpod_job(
    request: RunJobRequest,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    POST /run → Crée un job RunPod et renvoie le job_id
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication requise")
    
    user_id = current_user.get("sub") or current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="ID utilisateur introuvable")

    try:
        # 1. Préparer les données d'entrée
        input_data = await _prepare_runpod_input(request, user_id)
        
        # 2. Appeler RunPod
        runpod_response = await runpod_service.create_job(input_data)
        job_id = runpod_response['id']
        
        # 3. Métriques
        metrics_service.record_task_created(job_id, user_id)
        
        # 4. Log pour suivi
        logger.info(f"🚀 Job RunPod créé pour utilisateur {user_id}: {job_id}")
        
        return RunJobResponse(
            job_id=job_id,
            status=runpod_response.get('status', 'IN_QUEUE'),
            message=f"Job RunPod créé avec succès"
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Erreur création job RunPod: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")

@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    GET /status/{job_id} → Proxy vers RunPod + persistence optionnelle
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication requise")
    
    user_id = current_user.get("sub") or current_user.get("id")
    
    try:
        # 1. Récupérer le statut depuis RunPod
        runpod_status = await runpod_service.get_job_status(job_id)
        
        # 2. Métriques polling
        metrics_service.record_polling_request(user_id, runpod_status.get('status', 'unknown'))
        
        # 3. Si COMPLETED → extraire le résultat et persister optionnellement
        result_url = None
        if runpod_status.get('status') == 'COMPLETED' and runpod_status.get('output'):
            try:
                result_url = await _persist_result_if_needed(job_id, runpod_status['output'])
                if result_url:
                    logger.info(f"✅ Résultat persisté pour {job_id}: {result_url}")
                else:
                    # Si pas de persistence S3, passer le base64 directement
                    if 'output' in runpod_status['output'] and isinstance(runpod_status['output']['output'], dict):
                        base64_image = runpod_status['output']['output'].get('output')
                        if base64_image and base64_image.startswith('data:image'):
                            result_url = base64_image
                            logger.info(f"✅ Résultat base64 passé directement pour {job_id}")
            except Exception as e:
                logger.warning(f"⚠️ Échec persistence pour {job_id}: {str(e)}")
                # Continue sans bloquer - essayer de passer le base64 directement
                try:
                    if 'output' in runpod_status['output'] and isinstance(runpod_status['output']['output'], dict):
                        base64_image = runpod_status['output']['output'].get('output')
                        if base64_image and base64_image.startswith('data:image'):
                            result_url = base64_image
                            logger.info(f"✅ Fallback base64 pour {job_id}")
                except Exception:
                    pass
        
        # 4. Métriques de complétion
        if runpod_status.get('status') in ['COMPLETED', 'FAILED']:
            metrics_service.record_task_completed(job_id, user_id, runpod_status['status'])
        
        return JobStatusResponse(
            job_id=job_id,
            status=runpod_status.get('status', 'UNKNOWN'),
            output=runpod_status.get('output'),
            error=runpod_status.get('error'),
            result_url=result_url
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erreur récupération statut {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")

@router.delete("/cancel/{job_id}")
async def cancel_job(
    job_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Annuler un job RunPod"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication requise")
    
    try:
        result = await runpod_service.cancel_job(job_id)
        return {"message": f"Job {job_id} annulé", "result": result}
    except Exception as e:
        logger.error(f"❌ Erreur annulation {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur annulation")

# Fonctions helpers
async def _prepare_runpod_input(request: RunJobRequest, user_id: str) -> Dict[str, Any]:
    """Préparer les données d'entrée pour RunPod"""
    
    # 1. Traiter les images de vêtements
    if request.cloth_image_urls:
        # Télécharger les URLs et convertir en base64
        cloth_images = []
        import httpx
        async with httpx.AsyncClient(timeout=30.0) as client:
            for url in request.cloth_image_urls:
                try:
                    response = await client.get(url)
                    response.raise_for_status()
                    image_data = response.content
                    base64_data = base64.b64encode(image_data).decode('utf-8')
                    cloth_images.append(f"data:image/jpeg;base64,{base64_data}")
                except Exception as e:
                    logger.error(f"❌ Erreur téléchargement {url}: {e}")
                    continue
    elif request.cloth_images:
        cloth_images = request.cloth_images
    else:
        raise ValueError("Aucune image de vêtement fournie")
    
    if not cloth_images:
        raise ValueError("Impossible de traiter les images de vêtements")
    
    # 2. Traiter l'avatar
    person_image = None
    mask_image = None
    
    if request.person_image_data:
        person_image = request.person_image_data
        mask_image = request.mask_image_data
    elif request.person_s3_key:
        person_image = await _s3_to_base64(request.person_s3_key)
        if request.mask_s3_key:
            mask_image = await _s3_to_base64(request.mask_s3_key)
    else:
        # Récupérer l'avatar courant de l'utilisateur
        person_image, mask_image = await _get_current_user_avatar(user_id)
    
    if not person_image:
        raise ValueError("Aucune image de personne disponible")
    
    # 3. Préparer le payload RunPod
    # On prend seulement la première image pour simplifier
    input_data = {
        "person": person_image,
        "cloth": cloth_images[0],  # Première image seulement pour cette version
        "mask": mask_image,
        "steps": request.steps,
        "guidance_scale": request.guidance_scale,
        "return_dict": True
    }
    
    return input_data

async def _s3_to_base64(s3_key: str) -> str:
    """Convertir un fichier S3 en base64"""
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region
        )
        
        response = s3_client.get_object(Bucket=settings.s3_bucket_name, Key=s3_key)
        image_data = response['Body'].read()
        base64_data = base64.b64encode(image_data).decode('utf-8')
        
        return f"data:image/jpeg;base64,{base64_data}"
    except Exception as e:
        logger.error(f"❌ Erreur S3 → base64 pour {s3_key}: {e}")
        raise

async def _get_current_user_avatar(user_id: str) -> tuple[str, str]:
    """Récupérer l'avatar courant de l'utilisateur"""
    try:
        from app.services.supabase_service import SupabaseService
        supabase_service = SupabaseService()
        
        result = supabase_service.client.table('body_data').select('*').eq('user_id', user_id).eq('is_current', True).execute()
        
        if not result.data:
            raise ValueError("Aucun avatar courant trouvé")
        
        avatar = result.data[0]
        person_s3_key = avatar.get('person_image_s3_key')
        mask_s3_key = avatar.get('mask_s3_key')
        
        person_image = await _s3_to_base64(person_s3_key) if person_s3_key else None
        mask_image = await _s3_to_base64(mask_s3_key) if mask_s3_key else None
        
        return person_image, mask_image
        
    except Exception as e:
        logger.error(f"❌ Erreur récupération avatar utilisateur {user_id}: {e}")
        raise

async def _persist_result_if_needed(job_id: str, output: Dict[str, Any]) -> Optional[str]:
    """Persister le résultat vers S3 et retourner l'URL"""
    try:
        # Extraire l'image base64 depuis la structure RunPod: output.output
        base64_image = None
        
        # Structure RunPod: { output: { output: "data:image/png;base64,..." } }
        if 'output' in output and isinstance(output['output'], dict):
            base64_image = output['output'].get('output')
        # Fallback: structure directe
        elif 'output' in output and isinstance(output['output'], str):
            base64_image = output['output']
        # Autres fallbacks possibles
        else:
            base64_image = (
                output.get('image_url') or
                output.get('result_image') or
                output.get('image') or
                output.get('base64_image')
            )
        
        if not base64_image:
            logger.warning(f"⚠️ Aucune image résultat trouvée pour {job_id}")
            logger.warning(f"Structure output reçue: {list(output.keys())}")
            return None
        
        # Convertir base64 en bytes
        if base64_image.startswith('data:image'):
            # Format: data:image/png;base64,iVBORw0KGgo...
            base64_data = base64_image.split(',', 1)[1]
        else:
            # Assume c'est du base64 pur
            base64_data = base64_image
        
        import base64
        image_data = base64.b64decode(base64_data)
        
        # Upload vers S3
        s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region
        )
        
        s3_key = f"results/{job_id}/result_{int(datetime.now().timestamp())}.jpg"
        
        s3_client.put_object(
            Bucket=settings.s3_bucket_name,
            Key=s3_key,
            Body=image_data,
            ContentType='image/jpeg'
        )
        
        # Générer URL signée
        signed_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': settings.s3_bucket_name, 'Key': s3_key},
            ExpiresIn=3600  # 1 heure
        )
        
        return signed_url
        
    except Exception as e:
        logger.error(f"❌ Erreur persistence résultat {job_id}: {e}")
        return None