import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.schemas.tryon import TryOnRequest, TryOnResponse, TryOnSessionResponse
from app.services.tryon_service import TryOnService
from app.services.supabase_service import SupabaseService
from app.api.auth import get_current_user_optional

router = APIRouter()

tryon_service = TryOnService()

@router.post("/", response_model=TryOnResponse)
async def create_try_on(
    request: TryOnRequest,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Create a new virtual try-on session"""
    try:
        response = await tryon_service.process_try_on(request)
        return response
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/upload", response_model=dict)
async def upload_person_image(
    file: UploadFile = File(...),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Upload a person image for virtual try-on"""
    try:
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        content = await file.read()
        
        supabase_service = SupabaseService()
        file_path = f"person-images/{uuid.uuid4()}.{file.filename.split('.')[-1]}"
        
        upload_result = await supabase_service.upload_file(
            bucket_name="tryon-inputs",
            file_path=file_path,
            file_content=content,
            content_type=file.content_type
        )
        
        await supabase_service.close()
        
        return {
            "message": "Image uploaded successfully",
            "file_path": file_path,
            "url": upload_result.get("url")
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{session_id}/status", response_model=TryOnSessionResponse, include_in_schema=False)
async def get_try_on_status_no_slash(
    session_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get virtual try-on status (without slash)"""
    try:
        result = await tryon_service.get_try_on_status(session_id)
        return TryOnSessionResponse(
            session_id=result["session_id"],
            status=result["status"],
            results=result.get("results"),
            message=result.get("message", ""),
            error_message=result.get("error_message")
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/{session_id}/status/", response_model=TryOnSessionResponse)
async def get_try_on_status(
    session_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get virtual try-on status"""
    try:
        result = await tryon_service.get_try_on_status(session_id)
        return TryOnSessionResponse(
            session_id=result["session_id"],
            status=result["status"],
            results=result.get("results"),
            message=result.get("message", ""),
            error_message=result.get("error_message")
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
