import asyncio
import base64
import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
import httpx
import boto3
from botocore.exceptions import ClientError
import logging

from app.config import settings
from app.services.supabase_service import SupabaseService
from app.schemas.inference import (
    InferenceTaskStatus, 
    InferenceTaskEventType,
    CreateInferenceTaskRequest,
    InferenceResultItem
)

logger = logging.getLogger(__name__)

class InferenceService:
    def __init__(self):
        self.supabase_service = SupabaseService()
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region
        )
        self.http_client = httpx.AsyncClient(timeout=30.0)

    async def create_inference_task(
        self, 
        user_id: str, 
        request: CreateInferenceTaskRequest,
        jwt_token: str = None
    ) -> Tuple[str, str]:
        """Créer une nouvelle tâche d'inférence VTO"""
        tasks_created = []  # Initialiser en premier pour éviter les erreurs de scope
        
        try:
            # Utiliser les données avatar fournies ou récupérer de la base
            if request.person_image_data:
                # Cas 1: Images directes en base64 depuis le frontend
                logger.info(f"Utilisation des images base64 fournies pour la tâche {user_id}")
                person_s3_key = None
                mask_s3_key = None
                person_image_data = request.person_image_data
                mask_image_data = request.mask_image_data
            elif request.person_s3_key:
                # Cas 2: Clés S3 fournies, télécharger et convertir en base64
                logger.info(f"Utilisation des clés S3 fournies pour la tâche {user_id}")
                person_s3_key = request.person_s3_key
                mask_s3_key = request.mask_s3_key
                
                # Convertir les images S3 en base64 pour Runpod
                person_image_data = await self._s3_url_to_base64(person_s3_key)
                mask_image_data = await self._s3_url_to_base64(mask_s3_key) if mask_s3_key else None
                
                if not person_image_data:
                    raise ValueError("Impossible de récupérer l'image de la personne depuis S3")
            else:
                # Récupérer l'avatar courant de l'utilisateur depuis la base
                logger.info(f"Récupération de l'avatar depuis la base pour l'utilisateur {user_id}")
                avatar_data = await self._get_current_avatar(user_id)
                if not avatar_data:
                    raise ValueError("Aucun avatar courant trouvé pour l'utilisateur")
                
                person_s3_key = avatar_data.get('person_s3_key')
                mask_s3_key = avatar_data.get('mask_s3_key')
                
                # Convertir les URLs S3 en base64 pour Runpod
                person_image_data = await self._s3_url_to_base64(person_s3_key) if person_s3_key else None
                mask_image_data = await self._s3_url_to_base64(mask_s3_key) if mask_s3_key else None
                
                if not person_image_data:
                    raise ValueError("Impossible de récupérer l'image de la personne")
            
            # Traiter les images de vêtements - soit URLs soit base64
            
            if request.cloth_image_urls:
                # Cas préféré: télécharger les URLs côté backend
                cloth_images_data = []
                for i, cloth_url in enumerate(request.cloth_image_urls):
                    try:
                        # Télécharger et convertir en base64
                        cloth_base64 = await self._url_to_base64(cloth_url)
                        cloth_images_data.append(cloth_base64)
                    except Exception as e:
                        logger.error(f"Erreur lors du téléchargement de {cloth_url}: {str(e)}")
                        continue
                        
                if not cloth_images_data:
                    raise ValueError("Impossible de télécharger les images de vêtements")
                    
            else:
                # Fallback: utiliser les images base64 fournies
                cloth_images_data = request.cloth_images or []
            
            for i, cloth_image_data in enumerate(cloth_images_data):
                # Créer l'entrée dans la base de données
                task_id = str(uuid.uuid4())
                
                # Sauvegarder l'image cloth sur S3 pour référence
                cloth_s3_key = await self._save_cloth_image_to_s3(user_id, task_id, cloth_image_data, i)
                
                input_data = {
                    "steps": request.steps,
                    "guidance_scale": request.guidance_scale,
                    "return_dict": True,
                    "cloth_image_data": cloth_image_data,  # Image du vêtement
                    "person_image_data": person_image_data,  # Image de la personne
                    "mask_image_data": mask_image_data      # Mask de la personne
                }
                
                task_data = {
                    'id': task_id,
                    'user_id': user_id,
                    'status': InferenceTaskStatus.IN_QUEUE.value,
                    'input': json.dumps(input_data),
                    'person_s3_key': person_s3_key,
                    'cloth_s3_key': cloth_s3_key,
                    'mask_s3_key': mask_s3_key,
                    'progress': 0.0
                }
                
                # Insérer en base avec le JWT utilisateur pour RLS
                if jwt_token:
                    user_client = self.supabase_service.get_user_client(jwt_token)
                    result = user_client.table('inference_task').insert(task_data).execute()
                else:
                    result = self.supabase_service.client.table('inference_task').insert(task_data).execute()
                    
                if not result.data:
                    raise Exception(f"Échec de création de la tâche {task_id}")
                
                # Créer l'événement initial
                await self._create_task_event(task_id, InferenceTaskEventType.STATE, {
                    "status": InferenceTaskStatus.IN_QUEUE.value,
                    "message": "Tâche créée, en attente de traitement"
                }, jwt_token)
                
                tasks_created.append(task_id)
            
            # Traiter les tâches en arrière-plan avec le JWT token
            try:
                asyncio.create_task(self._process_inference_tasks(tasks_created, jwt_token))
            except Exception as bg_error:
                logger.warning(f"Erreur lors du lancement du traitement en arrière-plan: {bg_error}")
            
            # Vérifier que des tâches ont été créées
            if not tasks_created:
                raise Exception("Aucune tâche n'a pu être créée")
            
            logger.info(f"Tâches créées avec succès: {tasks_created}")
            logger.info(f"Type of tasks_created: {type(tasks_created)}")
            logger.info(f"Length of tasks_created: {len(tasks_created)}")
            return tasks_created[0] if len(tasks_created) == 1 else f"batch_{uuid.uuid4()}", "created"
            
        except Exception as e:
            logger.error(f"Erreur lors de la création de la tâche d'inférence: {str(e)}")
            raise

    async def _process_inference_tasks(self, task_ids: List[str], jwt_token: str = None):
        """Traiter les tâches d'inférence en arrière-plan"""
        for task_id in task_ids:
            try:
                await self._process_single_inference_task(task_id, jwt_token)
            except Exception as e:
                logger.error(f"Erreur lors du traitement de la tâche {task_id}: {str(e)}")
                await self._mark_task_failed(task_id, str(e))

    async def _process_single_inference_task(self, task_id: str, jwt_token: str = None):
        """Traiter une seule tâche d'inférence"""
        try:
            # Récupérer les détails de la tâche avec JWT utilisateur pour RLS
            if jwt_token:
                user_client = self.supabase_service.get_user_client(jwt_token)
                result = user_client.table('inference_task').select('*').eq('id', task_id).execute()
            else:
                result = self.supabase_service.client.table('inference_task').select('*').eq('id', task_id).execute()
                
            if not result.data:
                raise Exception(f"Tâche {task_id} introuvable")
            
            task_data = result.data[0]
            
            # Marquer comme en cours
            await self._update_task_status(task_id, InferenceTaskStatus.IN_PROGRESS, 10.0)
            await self._create_task_event(task_id, InferenceTaskEventType.STATE, {
                "status": InferenceTaskStatus.IN_PROGRESS.value,
                "message": "Préparation des images..."
            })
            
            # Télécharger et convertir les images en base64
            person_base64 = await self._s3_to_base64(task_data['person_s3_key'])
            
            # Récupérer l'image cloth depuis l'input (garder le format data: complet)
            input_data = json.loads(task_data['input'])
            cloth_image_data = input_data.get('cloth_image_data')
            cloth_base64 = cloth_image_data  # Garder le format data:image/jpeg;base64, complet
            
            mask_base64 = await self._s3_to_base64(task_data['mask_s3_key']) if task_data.get('mask_s3_key') else None
            
            await self._update_task_progress(task_id, 30.0)
            await self._create_task_event(task_id, InferenceTaskEventType.PROGRESS, {
                "progress": 30.0,
                "message": "Images préparées, envoi à Runpod..."
            })
            
            # Préparer le payload Runpod
            # 🔍 Debug: Afficher les 20 premiers caractères de chaque image (format complet)
            logger.info(f"👤 Person base64 (20 chars): {person_base64[:20] if person_base64 else 'None'}")
            logger.info(f"👕 Cloth base64 (20 chars): {cloth_base64[:20] if cloth_base64 else 'None'}")
            logger.info(f"🎭 Mask base64 (20 chars): {mask_base64[:20] if mask_base64 else 'None'}")
            
            runpod_payload = {
                "input": {
                    "person": person_base64,
                    "cloth": cloth_base64,
                    "mask": mask_base64,
                    "steps": json.loads(task_data['input'])['steps'],
                    "guidance_scale": json.loads(task_data['input'])['guidance_scale'],
                    "return_dict": True
                },
                "webhook": f"{settings.public_base_url}/api/inference_tasks/webhook"
            }
            
            # Appeler l'API Runpod
            job_id = await self._call_runpod_api(runpod_payload)
            
            # Mettre à jour avec le job_id
            self.supabase_service.client.table('inference_task').update({
                'job_id': job_id,
                'endpoint_id': settings.runpod_vto_endpoint
            }).eq('id', task_id).execute()
            
            await self._update_task_progress(task_id, 50.0)
            await self._create_task_event(task_id, InferenceTaskEventType.PROGRESS, {
                "progress": 50.0,
                "message": f"Traitement en cours par Runpod (Job ID: {job_id})"
            })
            
        except Exception as e:
            logger.error(f"Erreur lors du traitement de la tâche {task_id}: {str(e)}")
            await self._mark_task_failed(task_id, str(e))

    async def _call_runpod_api(self, payload: Dict[str, Any]) -> str:
        """Appeler l'API Runpod pour démarrer l'inférence"""
        if not settings.runpod_api_token or not settings.runpod_vto_endpoint:
            raise ValueError("Configuration Runpod manquante")
        
        headers = {
            "Authorization": f"Bearer {settings.runpod_api_token}",
            "Content-Type": "application/json"
        }
        
        url = f"https://api.runpod.ai/v2/{settings.runpod_vto_endpoint}/run"
        
        logger.info(f"📡 Envoi requête Runpod: {url}")
        logger.info(f"📋 Payload size: {len(str(payload))} chars")
        
        # Fix: Use the client directly
        response = await self.http_client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        
        result = response.json()
        logger.info(f"✅ Réponse Runpod: job_id={result.get('id')}")
        
        if 'id' not in result:
            raise Exception(f"Réponse Runpod invalide: {result}")
        
        return result['id']

    async def _s3_to_base64(self, s3_key: str) -> str:
        """Télécharger une image depuis S3 et la convertir en base64 avec préfixe data:"""
        try:
            response = self.s3_client.get_object(Bucket=settings.s3_bucket_name, Key=s3_key)
            image_data = response['Body'].read()
            base64_data = base64.b64encode(image_data).decode('utf-8')
            
            # Ajouter le préfixe data URL (détecter le type d'image)
            if s3_key.lower().endswith('.png'):
                return f"data:image/png;base64,{base64_data}"
            else:
                return f"data:image/jpeg;base64,{base64_data}"
        except ClientError as e:
            logger.error(f"Erreur lors du téléchargement S3 {s3_key}: {str(e)}")
            raise

    def _extract_base64_data(self, data_url: str) -> str:
        """Extraire les données base64 d'une Data URL ou retourner les données si déjà en base64"""
        if data_url.startswith('data:'):
            # Format: data:image/png;base64,iVBORw0K...
            return data_url.split(',')[1]
        else:
            # Déjà en base64 pur
            return data_url

    async def _save_cloth_image_to_s3(self, user_id: str, task_id: str, image_data: str, index: int = 0) -> str:
        """Sauvegarder une image cloth sur S3 pour référence"""
        try:
            # Extraire les données base64
            base64_data = self._extract_base64_data(image_data)
            image_bytes = base64.b64decode(base64_data)
            
            # Générer la clé S3
            s3_key = f"uploads/{user_id}/cloth/{task_id}_cloth_{index}.jpg"
            
            # Uploader vers S3
            self.s3_client.put_object(
                Bucket=settings.s3_bucket_name,
                Key=s3_key,
                Body=image_bytes,
                ContentType='image/jpeg'
            )
            
            return s3_key
            
        except Exception as e:
            logger.error(f"Erreur lors de la sauvegarde de l'image cloth: {str(e)}")
            raise

    async def _get_current_avatar(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Récupérer l'avatar courant de l'utilisateur"""
        try:
            # Requête pour trouver l'avatar courant
            result = self.supabase_service.client.table('body_data').select('*').eq('user_id', user_id).eq('is_current', True).execute()
            
            if not result.data:
                return None
            
            avatar = result.data[0]
            return {
                'person_s3_key': avatar.get('person_image_s3_key'),
                'mask_s3_key': avatar.get('mask_s3_key')
            }
        except Exception as e:
            logger.error(f"Erreur lors de la récupération de l'avatar: {str(e)}")
            return None

    async def _create_task_event(
        self, 
        task_id: str, 
        event_type: InferenceTaskEventType, 
        payload: Dict[str, Any],
        jwt_token: str = None
    ):
        """Créer un événement pour une tâche"""
        try:
            event_data = {
                'inference_task_id': task_id,
                'event_type': event_type.value,
                'payload': json.dumps(payload)
            }
            
            # Utiliser le client utilisateur si JWT token fourni
            if jwt_token:
                user_client = self.supabase_service.get_user_client(jwt_token)
                user_client.table('inference_task_event').insert(event_data).execute()
            else:
                self.supabase_service.client.table('inference_task_event').insert(event_data).execute()
        except Exception as e:
            logger.error(f"Erreur lors de la création de l'événement: {str(e)}")

    async def _update_task_status(
        self, 
        task_id: str, 
        status: InferenceTaskStatus, 
        progress: Optional[float] = None
    ):
        """Mettre à jour le statut d'une tâche"""
        try:
            update_data = {
                'status': status.value,
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
            
            if progress is not None:
                update_data['progress'] = progress
            
            if status == InferenceTaskStatus.COMPLETED:
                update_data['completed_at'] = datetime.now(timezone.utc).isoformat()
            elif status == InferenceTaskStatus.CANCELLED:
                update_data['canceled_at'] = datetime.now(timezone.utc).isoformat()
            
            self.supabase_service.client.table('inference_task').update(update_data).eq('id', task_id).execute()
        except Exception as e:
            logger.error(f"Erreur lors de la mise à jour du statut: {str(e)}")

    async def _update_task_progress(self, task_id: str, progress: float):
        """Mettre à jour uniquement le progress d'une tâche"""
        try:
            self.supabase_service.client.table('inference_task').update({
                'progress': progress,
                'updated_at': datetime.now(timezone.utc).isoformat()
            }).eq('id', task_id).execute()
        except Exception as e:
            logger.error(f"Erreur lors de la mise à jour du progress: {str(e)}")

    async def _mark_task_failed(self, task_id: str, error_message: str):
        """Marquer une tâche comme échouée"""
        try:
            await self._update_task_status(task_id, InferenceTaskStatus.FAILED)
            
            self.supabase_service.client.table('inference_task').update({
                'error_message': error_message
            }).eq('id', task_id).execute()
            
            await self._create_task_event(task_id, InferenceTaskEventType.ERROR, {
                "error": error_message,
                "status": InferenceTaskStatus.FAILED.value
            })
        except Exception as e:
            logger.error(f"Erreur lors du marquage d'échec: {str(e)}")

    async def handle_webhook(self, job_id: str, webhook_data: Dict[str, Any]):
        """Traiter un webhook de Runpod"""
        try:
            # Trouver la tâche correspondante
            result = self.supabase_service.client.table('inference_task').select('*').eq('job_id', job_id).execute()
            
            if not result.data:
                logger.warning(f"Tâche introuvable pour job_id: {job_id}")
                return
            
            task = result.data[0]
            task_id = task['id']
            
            # Enregistrer le webhook
            webhook_log = {
                'inference_task_id': task_id,
                'job_id': job_id,
                'payload': json.dumps(webhook_data),
                'processed': False
            }
            
            self.supabase_service.client.table('webhook_delivery').insert(webhook_log).execute()
            
            # Traiter selon le statut
            status = webhook_data.get('status', '').upper()
            
            if status == 'COMPLETED':
                await self._handle_successful_webhook(task_id, webhook_data)
            elif status == 'FAILED':
                error_msg = webhook_data.get('error', 'Échec du traitement Runpod')
                await self._mark_task_failed(task_id, error_msg)
            elif status == 'IN_PROGRESS':
                await self._update_task_progress(task_id, 75.0)
                await self._create_task_event(task_id, InferenceTaskEventType.PROGRESS, {
                    "progress": 75.0,
                    "message": "Traitement Runpod en cours..."
                })
            
            # Marquer le webhook comme traité
            self.supabase_service.client.table('webhook_delivery').update({
                'processed': True,
                'processed_at': datetime.now(timezone.utc).isoformat()
            }).eq('job_id', job_id).execute()
            
        except Exception as e:
            logger.error(f"Erreur lors du traitement du webhook {job_id}: {str(e)}")

    async def _handle_successful_webhook(self, task_id: str, webhook_data: Dict[str, Any]):
        """Traiter un webhook de succès"""
        try:
            # Récupérer le résultat de l'image
            output = webhook_data.get('output', {})
            result_image_url = output.get('image_url') or output.get('result_image')
            
            if result_image_url:
                # Télécharger et sauvegarder l'image résultante vers S3
                result_s3_key = await self._save_result_to_s3(task_id, result_image_url)
                
                # Mettre à jour la tâche
                await self._update_task_status(task_id, InferenceTaskStatus.COMPLETED, 100.0)
                
                output_data = {
                    "result_s3_key": result_s3_key,
                    "original_output": output
                }
                
                self.supabase_service.client.table('inference_task').update({
                    'output': json.dumps(output_data)
                }).eq('id', task_id).execute()
                
                await self._create_task_event(task_id, InferenceTaskEventType.RESULT, {
                    "status": InferenceTaskStatus.COMPLETED.value,
                    "result_s3_key": result_s3_key,
                    "message": "Traitement terminé avec succès"
                })
            else:
                await self._mark_task_failed(task_id, "Aucune image résultante dans la réponse Runpod")
                
        except Exception as e:
            logger.error(f"Erreur lors du traitement du succès: {str(e)}")
            await self._mark_task_failed(task_id, f"Erreur post-traitement: {str(e)}")

    async def _save_result_to_s3(self, task_id: str, image_url: str) -> str:
        """Télécharger l'image résultante et la sauvegarder sur S3"""
        try:
            # Télécharger l'image - Fix: Use client directly
            response = await self.http_client.get(image_url)
            response.raise_for_status()
            image_data = response.content
            
            # Générer la clé S3
            s3_key = f"results/{task_id}/result_{int(datetime.now().timestamp())}.jpg"
            
            # Uploader vers S3
            self.s3_client.put_object(
                Bucket=settings.s3_bucket_name,
                Key=s3_key,
                Body=image_data,
                ContentType='image/jpeg'
            )
            
            return s3_key
            
        except Exception as e:
            logger.error(f"Erreur lors de la sauvegarde S3: {str(e)}")
            raise

    async def get_task_status(self, task_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Récupérer le statut d'une tâche"""
        try:
            result = self.supabase_service.client.table('inference_task').select('*').eq('id', task_id).eq('user_id', user_id).execute()
            
            if not result.data:
                return None
            
            return result.data[0]
        except Exception as e:
            logger.error(f"Erreur lors de la récupération du statut: {str(e)}")
            return None

    async def generate_signed_url(self, s3_key: str, expires_in: int = 3600) -> str:
        """Générer une URL signée pour un fichier S3"""
        try:
            return self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': settings.s3_bucket_name, 'Key': s3_key},
                ExpiresIn=expires_in
            )
        except Exception as e:
            logger.error(f"Erreur lors de la génération d'URL signée: {str(e)}")
            raise

    async def _s3_url_to_base64(self, s3_key: str) -> Optional[str]:
        """Convertir une image S3 en base64"""
        try:
            # Télécharger l'image depuis S3
            response = self.s3_client.get_object(
                Bucket=settings.s3_bucket_name, 
                Key=s3_key
            )
            image_data = response['Body'].read()
            
            # Convertir en base64
            import base64
            base64_data = base64.b64encode(image_data).decode('utf-8')
            
            # Ajouter le préfix data URL si nécessaire
            if not base64_data.startswith('data:'):
                base64_data = f"data:image/jpeg;base64,{base64_data}"
            
            return base64_data
            
        except ClientError as e:
            logger.error(f"Erreur lors du téléchargement S3: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Erreur lors de la conversion base64: {str(e)}")
            return None

    async def _url_to_base64(self, url: str) -> str:
        """Télécharger une URL et la convertir en base64"""
        try:
            # Fix: Use the client directly, not as a context manager
            response = await self.http_client.get(url)
            response.raise_for_status()
            image_data = response.content
            
            import base64
            base64_data = base64.b64encode(image_data).decode('utf-8')
            
            # Ajouter le préfix data URL
            if not base64_data.startswith('data:'):
                base64_data = f"data:image/jpeg;base64,{base64_data}"
            
            return base64_data
            
        except Exception as e:
            logger.error(f"Erreur lors du téléchargement de {url}: {str(e)}")
            raise

    async def cleanup(self):
        """Nettoyer les ressources"""
        if hasattr(self, 'http_client'):
            await self.http_client.aclose()