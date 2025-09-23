from typing import Optional, Dict, Any
import logging
import asyncio
import uuid
import httpx
import boto3
from datetime import datetime
from app.config import settings
from app.services.supabase_service import SupabaseService
import base64
import io
from PIL import Image

logger = logging.getLogger(__name__)


class AvatarCreationService:
    """Service pour la création d'avatars avec masques via RunPod et stockage Supabase"""
    
    def __init__(self):
        self.processing_sessions = {}
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region
        )
        self.s3_bucket = settings.s3_bucket_name
        self.runpod_api_token = settings.runpod_api_token
        self.runpod_preprocessing_endpoint = settings.runpod_preprocessing_endpoint
    
    async def create_avatar(
        self,
        person_image_data: str,
        user_id: str,
        label: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fonction principale pour créer un avatar complet
        
        Args:
            person_image_data (str): Image en base64
            user_id (str): ID de l'utilisateur
            label (str, optional): Label pour l'avatar (ex: "Mannequin 01")
        
        Returns:
            Dict contenant l'ID du body créé et le statut
        """
        try:
            session_id = str(uuid.uuid4())
            
            logger.info(f"Début création avatar - Session: {session_id}, User: {user_id}")
            
            # Stocker la session
            self.processing_sessions[session_id] = {
                "status": "processing",
                "user_id": user_id,
                "label": label,
                "created_at": datetime.now().isoformat(),
                "progress": 0,
                "current_step": "Initialisation"
            }
            
            # Démarrer le traitement en arrière-plan
            asyncio.create_task(self._process_avatar_creation(session_id, person_image_data, user_id, label))
            
            return {
                "session_id": session_id,
                "status": "processing",
                "message": "Création d'avatar initiée",
                "estimated_time": 60  # secondes
            }
            
        except Exception as e:
            logger.error(f"Erreur lors de la création d'avatar: {e}")
            raise
    
    async def _process_avatar_creation(self, session_id: str, person_image_data: str, user_id: str, label: Optional[str]) -> None:
        """Traitement complet de création d'avatar avec stockage Supabase"""
        try:
            session = self.processing_sessions[session_id]
            supabase_service = SupabaseService()
            
            # Étape 1: Upload de l'image body sur S3
            session.update({"progress": 15, "current_step": "Upload image body sur S3"})
            body_s3_key, body_mime = await self._upload_body_image_to_s3(person_image_data, user_id, session_id)
            
            # Étape 2: Enregistrement du body dans Supabase
            session.update({"progress": 25, "current_step": "Enregistrement body dans Supabase"})
            body_id = await self._create_body_record(supabase_service, user_id, label, body_s3_key, body_mime)
            
            # Étape 3: Génération des masques via RunPod
            session.update({"progress": 45, "current_step": "Génération des masques via RunPod"})
            mask_images = await self.get_mask(person_image_data)
            
            # Étape 4: Upload des masques sur S3
            session.update({"progress": 65, "current_step": "Upload masques sur S3"})
            mask_s3_keys = await self._upload_masks_to_s3(mask_images, user_id, session_id)
            
            # Étape 5: Enregistrement des masques dans Supabase
            session.update({"progress": 85, "current_step": "Enregistrement masques dans Supabase"})
            await self._create_mask_records(supabase_service, body_id, mask_s3_keys)
            
            # Étape 6: Finalisation
            session.update({"progress": 100, "current_step": "Terminé"})
            avatar_result = {
                "body_id": body_id,
                "user_id": user_id,
                "label": label,
                "session_id": session_id,
                "created_at": datetime.now().isoformat()
            }
            
            session.update({
                "status": "completed",
                "result": avatar_result,
                "completed_at": datetime.now().isoformat()
            })
            
            await supabase_service.close()
            logger.info(f"Avatar créé avec succès - Body ID: {body_id}")
            
        except Exception as e:
            logger.error(f"Erreur lors du traitement avatar {session_id}: {e}")
            if session_id in self.processing_sessions:
                self.processing_sessions[session_id].update({
                    "status": "failed",
                    "error": str(e),
                    "failed_at": datetime.now().isoformat()
                })
    
    async def get_mask(self, body_image_data: str) -> Dict[str, bytes]:
        """
        Méthode principale pour générer les masques via RunPod preprocessing endpoint
        
        Args:
            body_image_data (str): Image body en base64
        
        Returns:
            Dict avec les trois masques: {"upper": bytes, "lower": bytes, "overall": bytes}
        """
        try:
            if not self.runpod_api_token or not self.runpod_preprocessing_endpoint:
                raise ValueError("RunPod API token ou preprocessing endpoint manquant dans la configuration")
            
            # Préparation de l'image pour RunPod
            image_data = body_image_data
            if body_image_data.startswith('data:image'):
                # Extraire le base64 si c'est un data URL
                image_data = body_image_data.split(',')[1]
            
            # Payload pour RunPod preprocessing endpoint
            payload = {
                "input": {
                    "image": image_data,
                    "task": "preprocessing",
                    "output_masks": ["upper", "lower", "overall"]
                }
            }
            
            headers = {
                "Authorization": f"Bearer {self.runpod_api_token}",
                "Content-Type": "application/json"
            }
            
            logger.info("Envoi requête à RunPod preprocessing endpoint")
            
            async with httpx.AsyncClient(timeout=180.0) as client:
                response = await client.post(
                    self.runpod_preprocessing_endpoint,
                    json=payload,
                    headers=headers
                )
                
                if response.status_code != 200:
                    raise Exception(f"Erreur RunPod: {response.status_code} - {response.text}")
                
                result = response.json()
                
                # Vérifier la structure de la réponse
                if "output" not in result:
                    raise Exception(f"Réponse RunPod invalide: {result}")
                
                output = result["output"]
                
                # Extraire les trois masques (adaptation pour le nouveau nom 'overall')
                mask_images = {}
                
                if "mask_upper" in output:
                    mask_images["upper"] = base64.b64decode(output["mask_upper"])
                else:
                    raise Exception("Masque upper manquant dans la réponse RunPod")
                
                if "mask_lower" in output:
                    mask_images["lower"] = base64.b64decode(output["mask_lower"])
                else:
                    raise Exception("Masque lower manquant dans la réponse RunPod")
                
                if "mask_overall" in output:
                    mask_images["overall"] = base64.b64decode(output["mask_overall"])
                else:
                    raise Exception("Masque overall manquant dans la réponse RunPod")
                
                logger.info("Masques générés avec succès via RunPod")
                return mask_images
                
        except Exception as e:
            logger.error(f"Erreur lors de la génération masques: {e}")
            raise
    
    async def _upload_body_image_to_s3(self, image_data: str, user_id: str, session_id: str) -> tuple[str, str]:
        """Upload de l'image body sur S3"""
        try:
            # Convertir base64 en bytes si nécessaire
            if image_data.startswith('data:image'):
                # Extraire le type MIME
                mime_part = image_data.split(',')[0]
                if 'jpeg' in mime_part or 'jpg' in mime_part:
                    content_type = 'image/jpeg'
                    extension = 'jpg'
                elif 'png' in mime_part:
                    content_type = 'image/png'
                    extension = 'png'
                else:
                    content_type = 'image/jpeg'
                    extension = 'jpg'
                
                image_data = image_data.split(',')[1]
            else:
                content_type = 'image/jpeg'
                extension = 'jpg'
            
            image_bytes = base64.b64decode(image_data)
            
            # Nom du fichier sur S3 (structure organisée par utilisateur)
            s3_key = f"users/{user_id}/bodies/{session_id}/body.{extension}"
            
            # Upload sur S3
            self.s3_client.put_object(
                Bucket=self.s3_bucket,
                Key=s3_key,
                Body=image_bytes,
                ContentType=content_type,
                ACL='public-read'
            )
            
            logger.info(f"Image body uploadée: {s3_key}")
            return s3_key, content_type
            
        except Exception as e:
            logger.error(f"Erreur upload body image: {e}")
            raise
    
    async def _upload_masks_to_s3(self, mask_images: Dict[str, bytes], user_id: str, session_id: str) -> Dict[str, str]:
        """Upload des masques sur S3"""
        try:
            mask_s3_keys = {}
            
            for mask_type, image_bytes in mask_images.items():
                # Nom du fichier sur S3
                s3_key = f"users/{user_id}/bodies/{session_id}/masks/{mask_type}.png"
                
                # Upload sur S3
                self.s3_client.put_object(
                    Bucket=self.s3_bucket,
                    Key=s3_key,
                    Body=image_bytes,
                    ContentType='image/png',
                    ACL='public-read'
                )
                
                mask_s3_keys[mask_type] = s3_key
                logger.info(f"Masque {mask_type} uploadé: {s3_key}")
            
            return mask_s3_keys
            
        except Exception as e:
            logger.error(f"Erreur upload masques: {e}")
            raise
    
    async def _create_body_record(self, supabase_service: SupabaseService, user_id: str, label: Optional[str], body_key: str, body_mime: str) -> str:
        """Créer l'enregistrement body dans Supabase"""
        try:
            # Préparer les données pour l'insertion
            body_data = {
                "user_id": user_id,
                "label": label or f"Avatar {datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "body_bucket": self.s3_bucket,
                "body_key": body_key,
                "body_mime": body_mime
            }
            
            # Insérer dans la table body
            query = supabase_service.client.table("body").insert(body_data)
            result = query.execute()
            
            if not result.data:
                raise Exception("Échec création enregistrement body")
            
            body_id = result.data[0]["id"]
            logger.info(f"Body record créé: {body_id}")
            return body_id
            
        except Exception as e:
            logger.error(f"Erreur création body record: {e}")
            raise
    
    async def _create_mask_records(self, supabase_service: SupabaseService, body_id: str, mask_s3_keys: Dict[str, str]) -> None:
        """Créer les enregistrements des masques dans Supabase"""
        try:
            mask_records = []
            
            for mask_type, s3_key in mask_s3_keys.items():
                mask_data = {
                    "body_id": body_id,
                    "kind": mask_type,  # 'upper', 'lower', 'overall'
                    "bucket": self.s3_bucket,
                    "object_key": s3_key,
                    "mime": "image/png"
                }
                mask_records.append(mask_data)
            
            # Insérer tous les masques
            query = supabase_service.client.table("body_masks").insert(mask_records)
            result = query.execute()
            
            if not result.data or len(result.data) != len(mask_records):
                raise Exception("Échec création enregistrements masques")
            
            logger.info(f"Masques enregistrés: {len(result.data)} records créés")
            
        except Exception as e:
            logger.error(f"Erreur création mask records: {e}")
            raise
    
    async def get_avatar_status(self, session_id: str) -> Dict[str, Any]:
        """Récupérer le statut de création d'un avatar"""
        session = self.processing_sessions.get(session_id)
        
        if not session:
            raise ValueError(f"Session {session_id} introuvable")
        
        return {
            "session_id": session_id,
            "status": session["status"],
            "progress": session.get("progress", 0),
            "current_step": session.get("current_step"),
            "result": session.get("result"),
            "error": session.get("error"),
            "created_at": session["created_at"],
            "completed_at": session.get("completed_at"),
            "failed_at": session.get("failed_at")
        }
    
    async def get_user_avatars(self, user_id: str) -> list:
        """Récupérer tous les avatars d'un utilisateur depuis Supabase"""
        try:
            supabase_service = SupabaseService()
            
            # Récupérer les bodies de l'utilisateur avec leurs masques
            query = supabase_service.client.table("body").select("*, body_masks(*)").eq("user_id", user_id)
            result = query.execute()
            
            await supabase_service.close()
            return result.data if result.data else []
            
        except Exception as e:
            logger.error(f"Erreur récupération avatars utilisateur {user_id}: {e}")
            raise