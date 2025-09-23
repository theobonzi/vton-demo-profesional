from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, Dict, Any, List
from app.services.avatar_creation_service import AvatarCreationService
from app.api.auth import get_current_user_optional
from app.config import settings
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class CreateAvatarRequest(BaseModel):
    person_image_data: str
    label: Optional[str] = None


class AvatarCheckResponse(BaseModel):
    has_avatar: bool
    avatar: Optional[Dict[str, Any]] = None
    body_url: Optional[str] = None
    mask_urls: Optional[Dict[str, str]] = None


@router.get("/check", response_model=AvatarCheckResponse)
async def check_user_avatar(
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Vérifier si l'utilisateur a déjà un avatar (image body)"""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Utilisateur non authentifié")
        
        user_id = current_user.get("sub")
        if not user_id:
            raise HTTPException(status_code=400, detail="ID utilisateur manquant")
        
        avatar_service = AvatarCreationService()
        avatars = await avatar_service.get_user_avatars(user_id)
        
        if not avatars or len(avatars) == 0:
            return AvatarCheckResponse(has_avatar=False)
        
        # Prendre le premier avatar (le plus récent)
        avatar = avatars[0]
        
        # Générer des URLs signées pour l'accès sécurisé
        body_url = avatar_service.generate_signed_url(avatar['body_key'])
        
        # Construire les URLs signées des masques
        mask_urls = {}
        if 'body_masks' in avatar and avatar['body_masks']:
            for mask in avatar['body_masks']:
                mask_type = mask['kind']
                mask_url = avatar_service.generate_signed_url(mask['object_key'])
                mask_urls[mask_type] = mask_url
        
        return AvatarCheckResponse(
            has_avatar=True,
            avatar=avatar,
            body_url=body_url,
            mask_urls=mask_urls if mask_urls else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la vérification avatar: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create")
async def create_avatar(
    request: CreateAvatarRequest,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Créer un nouvel avatar pour l'utilisateur"""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Utilisateur non authentifié")
        
        user_id = current_user.get("sub")
        if not user_id:
            raise HTTPException(status_code=400, detail="ID utilisateur manquant")
        
        avatar_service = AvatarCreationService()
        result = await avatar_service.create_avatar(
            person_image_data=request.person_image_data,
            user_id=user_id,
            label=request.label
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la création avatar: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{session_id}")
async def get_avatar_status(
    session_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Récupérer le statut de création d'un avatar"""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Utilisateur non authentifié")
        
        avatar_service = AvatarCreationService()
        status = await avatar_service.get_avatar_status(session_id)
        
        return status
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Erreur lors de la récupération statut avatar: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def get_user_avatars(
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Récupérer tous les avatars de l'utilisateur"""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Utilisateur non authentifié")
        
        user_id = current_user.get("sub")
        if not user_id:
            raise HTTPException(status_code=400, detail="ID utilisateur manquant")
        
        avatar_service = AvatarCreationService()
        avatars = await avatar_service.get_user_avatars(user_id)
        
        return avatars
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la récupération avatars: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{body_id}")
async def delete_avatar(
    body_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Supprimer un avatar (pour usage futur)"""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Utilisateur non authentifié")
        
        # TODO: Implémenter la suppression d'avatar
        # - Vérifier que l'avatar appartient à l'utilisateur
        # - Supprimer les fichiers S3
        # - Supprimer les enregistrements Supabase
        
        return {"message": "Suppression avatar non implémentée"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la suppression avatar: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/signed-url/{body_id}/{file_type}")
async def get_signed_url(
    body_id: str,
    file_type: str,  # 'body', 'upper', 'lower', 'overall'
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Générer une URL signée pour un fichier avatar"""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Utilisateur non authentifié")
        
        user_id = current_user.get("sub")
        if not user_id:
            raise HTTPException(status_code=400, detail="ID utilisateur manquant")
        
        avatar_service = AvatarCreationService()
        avatars = await avatar_service.get_user_avatars(user_id)
        
        # Trouver l'avatar spécifié
        avatar = next((a for a in avatars if a['body_id'] == body_id), None)
        if not avatar:
            raise HTTPException(status_code=404, detail="Avatar non trouvé")
        
        # Générer l'URL signée selon le type de fichier
        if file_type == 'body':
            s3_key = avatar['body_key']
        else:
            # Chercher le masque correspondant
            mask = next((m for m in avatar.get('body_masks', []) if m['kind'] == file_type), None)
            if not mask:
                raise HTTPException(status_code=404, detail=f"Masque {file_type} non trouvé")
            s3_key = mask['object_key']
        
        signed_url = avatar_service.generate_signed_url(s3_key, expires_in=3600)
        
        return {
            "signed_url": signed_url,
            "expires_in": 3600,
            "file_type": file_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur génération URL signée: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/set-current/{body_id}")
async def set_current_avatar(
    body_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Définir un avatar comme avatar actuel"""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Utilisateur non authentifié")
        
        user_id = current_user.get("sub")
        if not user_id:
            raise HTTPException(status_code=400, detail="ID utilisateur manquant")
        
        # Utiliser directement Supabase pour les mises à jour
        from app.services.supabase_service import SupabaseService
        supabase_service = SupabaseService()
        
        # Vérifier que l'avatar appartient à l'utilisateur
        check_query = supabase_service.client.table("body").select("body_id").eq("body_id", body_id).eq("user_id", user_id)
        check_result = check_query.execute()
        
        if not check_result.data:
            await supabase_service.close()
            raise HTTPException(status_code=404, detail="Avatar non trouvé")
        
        # Mettre tous les avatars de l'utilisateur à is_current=False
        update_all = supabase_service.client.table("body").update({"is_current": False}).eq("user_id", user_id)
        update_all.execute()
        
        # Mettre l'avatar spécifié à is_current=True
        update_current = supabase_service.client.table("body").update({"is_current": True}).eq("body_id", body_id)
        result = update_current.execute()
        
        await supabase_service.close()
        
        if result.data:
            return {"message": f"Avatar {body_id} défini comme avatar actuel"}
        else:
            raise HTTPException(status_code=500, detail="Échec mise à jour avatar")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur définition avatar actuel: {e}")
        raise HTTPException(status_code=500, detail=str(e))