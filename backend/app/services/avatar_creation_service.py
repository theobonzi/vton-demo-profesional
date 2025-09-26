from typing import Optional, Dict, Any
import logging
import asyncio
import uuid
import httpx
import boto3
from datetime import datetime
from app.config import settings
from app.services.supabase_service import SupabaseService
from app.services.photo_enhancement_service import PhotoEnhancementService
import base64

logger = logging.getLogger(__name__)


class AvatarCreationService:
    """Service pour la création d'avatars avec masques via RunPod et stockage Supabase"""
    
    def __init__(self):
        # Garde sessions en mémoire pour compatibilité, mais utilise aussi Supabase
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
        self.photo_enhancement_service = PhotoEnhancementService()
    
    def _extract_base64_data(self, data_url: str) -> bytes:
        """Extraire les données base64 d'une Data URL"""
        if data_url.startswith('data:'):
            # Format: data:image/png;base64,iVBORw0K...
            base64_data = data_url.split(',')[1]
        else:
            # Déjà en base64 pur
            base64_data = data_url
        
        return base64.b64decode(base64_data)
    
    async def _create_session_record(self, session_id: str, user_id: str, label: Optional[str] = None) -> None:
        """Créer un enregistrement de session dans Supabase"""
        try:
            supabase_service = SupabaseService()
            session_data = {
                "session_id": session_id,
                "user_id": user_id,
                "status": "processing",
                "progress": 0,
                "current_step": "Initialisation",
                "created_at": datetime.now().isoformat()
            }
            
            query = supabase_service.client.table("avatar_sessions").insert(session_data)
            result = query.execute()
            await supabase_service.close()
            
            if not result.data:
                raise Exception("Échec création session dans Supabase")
            
            logger.info(f"Session {session_id} créée dans Supabase")
            
        except Exception as e:
            logger.error(f"Erreur création session Supabase: {e}")
            # Ne pas lever l'erreur - le système peut fonctionner avec sessions mémoire
    
    async def _update_session_record(self, session_id: str, updates: dict) -> None:
        """Mettre à jour un enregistrement de session dans Supabase"""
        try:
            supabase_service = SupabaseService()
            
            # Ajouter timestamp de mise à jour
            updates["updated_at"] = datetime.now().isoformat()
            
            # Marquer completion/failure timestamps
            if updates.get("status") == "completed":
                updates["completed_at"] = datetime.now().isoformat()
            elif updates.get("status") == "failed":
                updates["failed_at"] = datetime.now().isoformat()
            
            query = supabase_service.client.table("avatar_sessions").update(updates).eq("session_id", session_id)
            result = query.execute()
            await supabase_service.close()
            
            if result.data:
                logger.debug(f"Session {session_id} mise à jour dans Supabase")
            
        except Exception as e:
            logger.error(f"Erreur mise à jour session Supabase: {e}")
            # Continue même si Supabase fail
    
    async def _get_session_from_db(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Récupérer une session depuis Supabase"""
        try:
            supabase_service = SupabaseService()
            
            query = supabase_service.client.table("avatar_sessions").select("*").eq("session_id", session_id)
            result = query.execute()
            await supabase_service.close()
            
            if result.data and len(result.data) > 0:
                session_data = result.data[0]
                return {
                    "session_id": session_data["session_id"],
                    "status": session_data["status"],
                    "progress": session_data["progress"],
                    "current_step": session_data["current_step"],
                    "error": session_data.get("error_message"),
                    "result": session_data.get("result"),
                    "created_at": session_data["created_at"],
                    "completed_at": session_data.get("completed_at"),
                    "failed_at": session_data.get("failed_at")
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Erreur récupération session depuis Supabase: {e}")
            return None
    
    async def _update_session(self, session_id: str, updates: dict) -> None:
        """Mettre à jour session en mémoire ET dans Supabase"""
        # Mise à jour mémoire
        if session_id in self.processing_sessions:
            self.processing_sessions[session_id].update(updates)
        
        # Mise à jour Supabase (async, ne bloque pas si ça fail)
        await self._update_session_record(session_id, updates)
    
    def generate_signed_url(self, s3_key: str, expires_in: int = 3600) -> str:
        """Générer une URL signée pour un objet S3"""
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.s3_bucket, 'Key': s3_key},
                ExpiresIn=expires_in
            )
            return url
        except Exception as e:
            logger.error(f"Erreur génération URL signée pour {s3_key}: {e}")
            # Fallback vers URL directe (ne fonctionnera que si bucket public)
            if settings.s3_custom_domain:
                return f"https://{settings.s3_custom_domain}/{s3_key}"
            else:
                return f"https://{self.s3_bucket}.s3.{settings.aws_region}.amazonaws.com/{s3_key}"
    
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
            
            # Stocker la session en mémoire ET dans Supabase
            session_data = {
                "status": "processing",
                "user_id": user_id,
                "label": label,
                "created_at": datetime.now().isoformat(),
                "progress": 0,
                "current_step": "Initialisation"
            }
            self.processing_sessions[session_id] = session_data
            logger.info(f"Session {session_id} créée et stockée en mémoire")
            
            # Créer aussi dans Supabase pour persistance
            await self._create_session_record(session_id, user_id, label)
            
            # Démarrer le traitement en arrière-plan
            task = asyncio.create_task(self._process_avatar_creation(session_id, person_image_data, user_id, label))
            logger.info(f"Tâche de traitement démarrée pour session {session_id}")
            
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
        supabase_service: Optional[SupabaseService] = None
        try:
            session = self.processing_sessions[session_id]
            supabase_service = SupabaseService()
            
            # Étape 1: Amélioration de la photo via Gemini
            await self._update_session(session_id, {"progress": 10, "current_step": "Amélioration de l'image via Gemini"})
            person_image_data = await self.photo_enhancement_service.enhance_to_studio(person_image_data)

            # Étape 2: Upload de l'image body sur S3
            await self._update_session(session_id, {"progress": 30, "current_step": "Upload image body sur S3"})
            body_s3_key, body_mime = await self._upload_body_image_to_s3(person_image_data, user_id, session_id)
            
            # Étape 3: Enregistrement du body dans Supabase
            await self._update_session(session_id, {"progress": 45, "current_step": "Enregistrement body dans Supabase"})
            body_id = await self._create_body_record(supabase_service, user_id, label, body_s3_key, body_mime)
            
            # Étape 4: Génération des masques via RunPod
            await self._update_session(session_id, {"progress": 60, "current_step": "Génération des masques via RunPod"})
            mask_images = await self.get_mask(person_image_data)
            # Wait 2s to ensure RunPod has finalized processing
            
            # Étape 5: Upload des masques sur S3
            await self._update_session(session_id, {"progress": 80, "current_step": "Upload masques sur S3"})
            mask_s3_keys = await self._upload_masks_to_s3(mask_images, user_id, session_id)
            
            # Étape 6: Enregistrement des masques dans Supabase
            await self._update_session(session_id, {"progress": 90, "current_step": "Enregistrement masques dans Supabase"})
            await self._create_mask_records(supabase_service, body_id, mask_s3_keys)
            
            # Étape 7: Finalisation
            await self._update_session(session_id, {"progress": 100, "current_step": "Terminé"})
            avatar_result = {
                "body_id": body_id,
                "user_id": user_id,
                "label": label,
                "session_id": session_id,
                "created_at": datetime.now().isoformat()
            }
            
            await self._update_session(session_id, {
                "status": "completed",
                "result": avatar_result,
                "completed_at": datetime.now().isoformat()
            })
            logger.info(f"Avatar créé avec succès - Body ID: {body_id}")
            
        except Exception as e:
            logger.error(f"Erreur lors du traitement avatar {session_id}: {e}")
            # Mettre à jour le statut d'erreur dans les deux systèmes
            await self._update_session(session_id, {
                "status": "failed",
                "error_message": str(e),
                "failed_at": datetime.now().isoformat()
            })
        finally:
            if supabase_service:
                try:
                    await supabase_service.close()
                except Exception as close_error:
                    logger.error(f"Erreur fermeture SupabaseService: {close_error}")
    
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
            
            # Payload pour RunPod preprocessing endpoint
            payload = {
                "input": {
                    "person": image_data,
                    # "parts": ["upper", "lower", "overall"]
                }
            }
            
            logger.info(f"API Token RunPod : {'****' + self.runpod_api_token[-4:]}")
            headers = {
                "Authorization": f"Bearer {self.runpod_api_token}",
                "Content-Type": "application/json"
            }
            
            logger.info("Envoi requête à RunPod preprocessing endpoint")
            
            async with httpx.AsyncClient(timeout=600.0) as client:
                logger.info("Attente réponse de RunPod...")
                response = await client.post(
                    self.runpod_preprocessing_endpoint,
                    json=payload,
                    headers=headers
                )

                logger.info("Réponse reçue de RunPod")

                
                if response.status_code != 200:
                    logger.error(f"Erreur RunPod: {response.status_code}")
                    raise Exception(f"Erreur RunPod: {response.status_code} - {response.text}")
                
                result = response.json()
                
                # Vérifier la structure de la réponse
                if "output" not in result:
                    raise Exception(f"Réponse RunPod invalide: {result}")
                
                output_mask = result["output"]["output"]["masks"]
                logger.info(f"Réponse RunPod: {list(output_mask.keys())}")
                
                # Extraire les trois masques (adaptation pour le nouveau nom 'overall')
                mask_images = {}
                
                if "upper" in output_mask:
                    mask_images["upper"] = self._extract_base64_data(output_mask["upper"])
                else:
                    raise Exception("Masque upper manquant dans la réponse RunPod")
                
                if "lower" in output_mask:
                    mask_images["lower"] = self._extract_base64_data(output_mask["lower"])
                else:
                    raise Exception("Masque lower manquant dans la réponse RunPod")
                
                if "dress" in output_mask:
                    mask_images["overall"] = self._extract_base64_data(output_mask["dress"])
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
            # Déterminer le type MIME et l'extension
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
            else:
                content_type = 'image/jpeg'
                extension = 'jpg'
            
            # Utiliser la fonction helper pour extraire et décoder les données
            image_bytes = self._extract_base64_data(image_data)
            
            # Nom du fichier sur S3 (structure organisée par utilisateur)
            s3_key = f"users/{user_id}/bodies/{session_id}/body.{extension}"
            
            # Upload sur S3
            self.s3_client.put_object(
                Bucket=self.s3_bucket,
                Key=s3_key,
                Body=image_bytes,
                ContentType=content_type
                # ACL supprimé - le bucket doit être configuré pour l'accès public via bucket policy
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
                    ContentType='image/png'
                    # ACL supprimé - le bucket doit être configuré pour l'accès public via bucket policy
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
            # Étape 1: Mettre tous les avatars existants de l'utilisateur à is_current=False
            update_query = supabase_service.client.table("body").update({"is_current": False}).eq("user_id", user_id)
            update_result = update_query.execute()
            logger.info(f"Mis à jour {len(update_result.data) if update_result.data else 0} avatars existants à is_current=False")
            
            # Étape 2: Préparer les données pour l'insertion du nouveau avatar
            body_data = {
                "user_id": user_id,
                "label": label or f"Avatar {datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "body_bucket": self.s3_bucket,
                "body_key": body_key,
                "body_mime": body_mime,
                "is_current": True  # Le nouveau avatar devient l'avatar actuel
            }
            
            # Étape 3: Insérer le nouveau body
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
        
        # D'abord essayer de récupérer depuis Supabase (source fiable)
        db_session = await self._get_session_from_db(session_id)
        if db_session:
            logger.debug(f"Session {session_id} trouvée dans Supabase")
            return db_session
        
        # Fallback: essayer la mémoire locale
        memory_session = self.processing_sessions.get(session_id)
        if memory_session:
            logger.debug(f"Session {session_id} trouvée en mémoire")
            return {
                "session_id": session_id,
                "status": memory_session["status"],
                "progress": memory_session.get("progress", 0),
                "current_step": memory_session.get("current_step"),
                "result": memory_session.get("result"),
                "error": memory_session.get("error"),
                "created_at": memory_session["created_at"],
                "completed_at": memory_session.get("completed_at"),
                "failed_at": memory_session.get("failed_at")
            }
        
        # Aucune session trouvée - retourner statut de traitement en cours
        logger.warning(f"Session {session_id} introuvable dans Supabase ET mémoire")
        return {
            "session_id": session_id,
            "status": "processing",  # Garder en processing jusqu'à confirmation
            "progress": 20,  # Progress modéré
            "current_step": "Traitement en cours...",
            "result": None,
            "error": None,
            "created_at": datetime.now().isoformat(),
            "completed_at": None,
            "failed_at": None
        }
    
    async def get_user_avatars(self, user_id: str) -> list:
        """Récupérer tous les avatars d'un utilisateur depuis Supabase"""
        try:
            supabase_service = SupabaseService()
            
            # Récupérer seulement l'avatar actuel (is_current=True) avec ses masques
            query = supabase_service.client.table("body").select("*, body_masks(*)").eq("user_id", user_id).eq("is_current", True)
            result = query.execute()
            
            await supabase_service.close()
            return result.data if result.data else []
            
        except Exception as e:
            logger.error(f"Erreur récupération avatars utilisateur {user_id}: {e}")
            raise
