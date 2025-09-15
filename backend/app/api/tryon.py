from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import Optional, Dict, Any
from app.schemas.tryon import TryOnRequest, TryOnResponse, TryOnSessionResponse, ProductInfo
from app.services.tryon_service import TryOnService
from app.services.supabase_service import SupabaseService
from app.api.auth import get_current_user_optional
import asyncio
import uuid

router = APIRouter()

session_storage: Dict[str, Dict[str, Any]] = {}

@router.post("/", response_model=TryOnResponse)
async def create_try_on(
    request: TryOnRequest,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Create a new virtual try-on session"""
    try:
        tryon_service = TryOnService()
        
        session_id = request.session_id or str(uuid.uuid4())
        session_storage[session_id] = {
            "product_ids": request.product_ids,
            "products_info": request.products_info,
            "person_image_url": request.person_image_url,
            "created_at": asyncio.get_event_loop().time()
        }
        
        response = await tryon_service.process_try_on(request)
        asyncio.create_task(simulate_try_on_processing(session_id, request))
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
        tryon_service = TryOnService()
        result = await tryon_service.get_try_on_status(session_id)
        
        return TryOnSessionResponse(
            session_id=result["session_id"],
            status=result["status"],
            results=result.get("results"),
            message=result.get("message", ""),
            error_message=result.get("error_message")
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{session_id}/status/", response_model=TryOnSessionResponse)
async def get_try_on_status(
    session_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get virtual try-on status"""
    try:
        await asyncio.sleep(2)
        
        session_data = session_storage.get(session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        product_ids = session_data["product_ids"]
        products_info = session_data.get("products_info", [])
        
        fake_results = {}
        
        for i, product_id in enumerate(product_ids):
            product_info = None
            if products_info:
                for p_info in products_info:
                    if p_info.id == product_id:
                        product_info = p_info
                        break
            
            if product_info:
                product_name = product_info.name
                product_image = product_info.image_url
                
                fake_results[f"product_{product_id}"] = {
                    "product_id": product_id,
                    "product_name": product_name,
                    "result_image": product_image,
                    "status": "success"
                }
            else:
                fake_results[f"product_{product_id}"] = {
                    "product_id": product_id,
                    "product_name": f"Selected Item #{product_id}",
                    "result_image": "https://via.placeholder.com/400x600?text=Product+Missing",
                    "status": "success"
                }
        
        return TryOnSessionResponse(
            session_id=session_id,
            status="completed",
            results=fake_results,
            message=f"Virtual try-on completed successfully - {len(fake_results)} result(s)"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def simulate_try_on_processing(session_id: str, request: TryOnRequest):
    """Simulate virtual try-on processing in background"""
    processing_time = 2 + len(request.product_ids) * 0.5
    await asyncio.sleep(processing_time)
