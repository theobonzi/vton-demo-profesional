"""
Service RunPod simplifié - Proxy direct sans webhooks
"""
import httpx
import logging
import time
from typing import Dict, Any, Optional
from app.config import settings
from app.services.metrics_service import metrics_service, track_runpod_api_call

logger = logging.getLogger(__name__)

class RunPodService:
    def __init__(self):
        self.http_client = httpx.AsyncClient(timeout=30.0)
        
        if not settings.runpod_api_token:
            logger.warning("⚠️ RUNPOD_API_TOKEN non configuré")
        if not settings.runpod_vto_endpoint:
            logger.warning("⚠️ RUNPOD_VTO_ENDPOINT non configuré")

    @track_runpod_api_call("run")
    async def create_job(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Créer un job RunPod - POST /v2/<endpoint>/run
        
        Args:
            input_data: Données d'entrée pour RunPod
            
        Returns:
            {"id": "job-id-123", "status": "IN_QUEUE"}
        """
        if not settings.runpod_api_token or not settings.runpod_vto_endpoint:
            raise ValueError("Configuration RunPod manquante")
            
        url = f"https://api.runpod.ai/v2/{settings.runpod_vto_endpoint}/run"
        headers = {
            "Authorization": f"Bearer {settings.runpod_api_token}",
            "Content-Type": "application/json"
        }
        
        payload = {"input": input_data}
        
        logger.info(f"🚀 Création job RunPod: {url}")
        logger.info(f"📦 Input data size: {len(str(input_data))} chars")
        
        try:
            response = await self.http_client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            
            result = response.json()
            job_id = result.get('id')
            
            if not job_id:
                raise ValueError(f"Pas de job_id dans la réponse RunPod: {result}")
            
            logger.info(f"✅ Job RunPod créé: {job_id}")
            return result
            
        except httpx.HTTPStatusError as e:
            logger.error(f"❌ Erreur HTTP RunPod create: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"❌ Erreur création job RunPod: {str(e)}")
            raise

    @track_runpod_api_call("status")
    async def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """
        Récupérer le statut d'un job - GET /v2/<endpoint>/status/{jobId}
        
        Args:
            job_id: ID du job RunPod
            
        Returns:
            {
                "id": "job-id-123",
                "status": "IN_PROGRESS" | "COMPLETED" | "FAILED",
                "output": {...} (si COMPLETED),
                "error": "..." (si FAILED)
            }
        """
        if not settings.runpod_api_token or not settings.runpod_vto_endpoint:
            raise ValueError("Configuration RunPod manquante")
            
        url = f"https://api.runpod.ai/v2/{settings.runpod_vto_endpoint}/status/{job_id}"
        headers = {
            "Authorization": f"Bearer {settings.runpod_api_token}"
        }
        
        try:
            response = await self.http_client.get(url, headers=headers)
            response.raise_for_status()
            
            result = response.json()
            status = result.get('status', 'UNKNOWN')
            
            logger.info(f"📊 Job {job_id} status: {status}")
            logger.info(f"Status key values: {list(result.keys())}")
            
            # Log détaillé pour debug
            if status == 'COMPLETED' and result.get('output'):
                logger.info(f"Output keys: {list(result['output'].keys())}")
                logger.info(f"Keys in output: {result['output']['output'][:20]}")
                logger.info(f"🎉 Job {job_id} terminé avec output")
            elif status == 'FAILED' and result.get('error'):
                logger.warning(f"❌ Job {job_id} échoué: {result.get('error')}")
            
            return result
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.warning(f"🔍 Job {job_id} introuvable (peut-être trop ancien)")
                return {
                    "id": job_id,
                    "status": "NOT_FOUND",
                    "error": "Job not found or expired"
                }
            
            logger.error(f"❌ Erreur HTTP RunPod status: {e.response.status_code} - {e.response.text}")
            raise
            
        except Exception as e:
            logger.error(f"❌ Erreur récupération statut {job_id}: {str(e)}")
            raise

    async def cancel_job(self, job_id: str) -> Dict[str, Any]:
        """
        Annuler un job RunPod - POST /v2/<endpoint>/cancel/{jobId}
        
        Args:
            job_id: ID du job à annuler
            
        Returns:
            {"status": "cancelled"} ou erreur
        """
        if not settings.runpod_api_token or not settings.runpod_vto_endpoint:
            raise ValueError("Configuration RunPod manquante")
            
        url = f"https://api.runpod.ai/v2/{settings.runpod_vto_endpoint}/cancel/{job_id}"
        headers = {
            "Authorization": f"Bearer {settings.runpod_api_token}",
            "Content-Type": "application/json"
        }
        
        try:
            response = await self.http_client.post(url, headers=headers)
            response.raise_for_status()
            
            result = response.json()
            logger.info(f"🛑 Job {job_id} annulé")
            return result
            
        except Exception as e:
            logger.error(f"❌ Erreur annulation job {job_id}: {str(e)}")
            raise

    async def health_check(self) -> Dict[str, Any]:
        """
        Vérifier la santé de l'endpoint RunPod
        
        Returns:
            {"status": "healthy", "endpoint_info": {...}}
        """
        if not settings.runpod_api_token or not settings.runpod_vto_endpoint:
            return {
                "status": "unhealthy",
                "error": "Configuration RunPod manquante"
            }
            
        url = f"https://api.runpod.ai/v2/{settings.runpod_vto_endpoint}"
        headers = {
            "Authorization": f"Bearer {settings.runpod_api_token}"
        }
        
        try:
            start_time = time.time()
            response = await self.http_client.get(url, headers=headers)
            latency = round((time.time() - start_time) * 1000, 2)
            
            if response.status_code == 200:
                endpoint_info = response.json()
                return {
                    "status": "healthy",
                    "endpoint_info": endpoint_info,
                    "latency_ms": latency
                }
            else:
                return {
                    "status": "degraded",
                    "http_status": response.status_code,
                    "latency_ms": latency
                }
                
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }

    async def cleanup(self):
        """Nettoyer les ressources"""
        if hasattr(self, 'http_client'):
            await self.http_client.aclose()

# Instance globale
runpod_service = RunPodService()