from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import Optional, Dict, Any, List
from app.schemas.tryon import TryOnRequest, TryOnResponse, TryOnSessionResponse, ProductInfo
from app.services.tryon_service import TryOnService
from app.services.supabase_service import SupabaseService
from app.api.auth import get_current_user_optional
from pydantic import BaseModel, EmailStr
from app.services.email_service import EmailService
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


class SummaryItem(BaseModel):
    product_id: int
    name: str
    price: Optional[str] = None
    brand: Optional[str] = None
    image_url: Optional[str] = None
    result_image_url: Optional[str] = None


class EmailSummaryRequest(BaseModel):
    email: EmailStr
    session_id: Optional[str] = None
    items: List[SummaryItem]


@router.post("/send-summary", response_model=dict)
async def send_tryon_summary(payload: EmailSummaryRequest, current_user: Optional[dict] = Depends(get_current_user_optional)):
    try:
        if not payload.items:
            raise HTTPException(status_code=400, detail="Aucun produit à inclure dans le résumé")

        # Build a simple HTML summary
        items_html = "".join([
            f"""
            <tr>
              <td style='padding:8px;border-bottom:1px solid #eee;'>
                <div style='display:flex;gap:12px;align-items:center'>
                  {f"<img src='{i.image_url or i.result_image_url or ''}' alt='{i.name}' width='64' height='64' style='object-fit:cover;border-radius:8px;'/>" if (i.image_url or i.result_image_url) else ''}
                  <div>
                    <div style='font-weight:600;color:#111'>{i.name}</div>
                    {f"<div style='color:#555;font-size:12px'>{i.brand}</div>" if i.brand else ''}
                    {f"<div style='color:#111;font-size:13px;margin-top:2px'>{i.price}</div>" if i.price else ''}
                  </div>
                </div>
              </td>
            </tr>
            """
            for i in payload.items
        ])

        html = f"""
        <div style='font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial,sans-serif'>
          <h2 style='font-weight:600'>Résumé de votre essayage virtuel</h2>
          {f"<div style='color:#555;font-size:12px;margin-bottom:8px'>Session: {payload.session_id}</div>" if payload.session_id else ''}
          <table style='border-collapse:collapse;width:100%;max-width:640px;background:#fff;border:1px solid #eee;border-radius:8px;overflow:hidden'>
            <tbody>
              {items_html}
            </tbody>
          </table>
          <p style='color:#555;margin-top:16px'>Merci d'utiliser WearIt.</p>
        </div>
        """

        subject = "Votre résumé d'essayage virtuel"
        email_service = EmailService()
        email_service.send_email(payload.email, subject, html, "Résumé de votre essayage virtuel")

        return {"status": "ok", "message": "Résumé envoyé"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
