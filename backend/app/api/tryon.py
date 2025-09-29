from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import Optional, Dict, Any, List
from app.schemas.tryon import TryOnRequest, TryOnResponse, TryOnSessionResponse, ProductInfo
from app.services.tryon_service import TryOnService
from app.services.supabase_service import SupabaseService
from app.services.runpod_service import RunPodService
from app.services.gemini_service import GeminiService
from app.api.auth import get_current_user_optional
from pydantic import BaseModel, EmailStr
from app.services.email_service import EmailService
import asyncio
import uuid
import logging
import boto3
import base64
import httpx
from app.config import settings
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()

# Store session state with real-time results per product
session_storage: Dict[str, Dict[str, Any]] = {}

@router.post("/", response_model=TryOnResponse)
async def create_try_on(
    request: TryOnRequest,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Create a new virtual try-on session with parallel processing"""
    try:
        session_id = request.session_id or str(uuid.uuid4())
        
        # Get user ID
        user_id = None
        if current_user:
            user_id = current_user.get("sub") or current_user.get("id")
        
        # Initialize session with processing state
        session_storage[session_id] = {
            "user_id": user_id,
            "product_ids": request.product_ids,
            "products_info": request.products_info,
            "person_image_url": request.person_image_url,
            "created_at": asyncio.get_event_loop().time(),
            "status": "processing",
            "results": {},
            "progress": {},
            "errors": {}
        }
        
        logger.info(f"🚀 Starting parallel try-on for session {session_id} with {len(request.product_ids)} products")
        
        # Launch parallel processing for each product
        tasks = []
        for product_id in request.product_ids:
            task = asyncio.create_task(
                process_product_inference(session_id, product_id, request)
            )
            tasks.append(task)
        
        # Start background monitoring to update session status
        asyncio.create_task(monitor_session_completion(session_id, len(request.product_ids)))
        
        return TryOnResponse(
            session_id=session_id,
            status="processing", 
            message=f"Traitement en cours pour {len(request.product_ids)} produit(s)..."
        )
        
    except Exception as e:
        logger.error(f"❌ Error creating try-on session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def _url_to_base64(url: str) -> str:
    """Convert image URL to base64"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            image_data = response.content
            base64_data = base64.b64encode(image_data).decode('utf-8')
            return f"data:image/jpeg;base64,{base64_data}"
    except Exception as e:
        logger.error(f"❌ Error converting URL to base64 {url}: {e}")
        raise

async def _s3_to_base64(s3_key: str) -> str:
    """Convert S3 file to base64"""
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
        logger.error(f"❌ Error S3 → base64 for {s3_key}: {e}")
        raise

async def _get_current_user_avatar_for_tryon(user_id: str, mask_kind: str = "overall") -> tuple[str, str]:
    """Get current user avatar with proper mask"""
    try:
        from app.services.supabase_service import SupabaseService
        supabase_service = SupabaseService()
        
        result = supabase_service.client.table('body').select('*, body_masks(*)').eq('user_id', user_id).eq('is_current', True).execute()
        
        if not result.data:
            raise ValueError("No current avatar found")
        
        avatar = result.data[0]
        person_s3_key = avatar.get('body_key')
        
        # Find the right mask
        mask_s3_key = None
        if avatar.get('body_masks'):
            for mask in avatar['body_masks']:
                if mask['kind'] == mask_kind:
                    mask_s3_key = mask['object_key']
                    break
        
        if not mask_s3_key:
            logger.warning(f"⚠️ Mask {mask_kind} not found, trying overall fallback")
            for mask in avatar.get('body_masks', []):
                if mask['kind'] == 'overall':
                    mask_s3_key = mask['object_key']
                    break
        
        person_image = await _s3_to_base64(person_s3_key) if person_s3_key else None
        mask_image = await _s3_to_base64(mask_s3_key) if mask_s3_key else None
        
        logger.info(f"✅ Avatar retrieved with {mask_kind} mask: person={bool(person_image)}, mask={bool(mask_image)}")
        logger.info(f"🔧 Using body_key: {person_s3_key}, mask_key: {mask_s3_key}")
        return person_image, mask_image
        
    except Exception as e:
        logger.error(f"❌ Error getting avatar for user {user_id}: {e}")
        raise

async def _persist_result_to_s3(job_id: str, base64_image: str) -> str:
    """Persist result to S3 and return signed URL"""
    try:
        # Convert base64 to bytes
        if base64_image.startswith('data:image'):
            # Format: data:image/png;base64,iVBORw0KGgo...
            base64_data = base64_image.split(',', 1)[1]
        else:
            # Assume it's pure base64
            base64_data = base64_image
        
        image_data = base64.b64decode(base64_data)
        
        # Upload to S3
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
        
        # Generate signed URL
        signed_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': settings.s3_bucket_name, 'Key': s3_key},
            ExpiresIn=3600  # 1 hour
        )
        
        logger.info(f"✅ Result persisted for {job_id}: {signed_url}")
        return signed_url
        
    except Exception as e:
        logger.error(f"❌ Error persisting result {job_id}: {e}")
        return None

async def process_product_inference(session_id: str, product_id: int, request: TryOnRequest):
    """Process inference for a single product using real AI services"""
    try:
        session_data = session_storage.get(session_id)
        if not session_data:
            return
            
        logger.info(f"🔄 Starting inference for product {product_id} in session {session_id}")
        
        # Mark as started
        session_data["progress"][product_id] = {"status": "started", "progress": 0}
        
        # Get product info
        product_info = None
        for p in (session_data.get("products_info") or []):
            if p.id == product_id:
                product_info = p
                break
        
        if not product_info:
            logger.warning(f"⚠️ Product info not found for {product_id}")
            session_data["errors"][product_id] = "Product info not found"
            return
            
        # Update progress
        session_data["progress"][product_id] = {"status": "processing", "progress": 25}
        
        # Get user ID
        user_id = session_data.get("user_id")
        if not user_id:
            logger.warning(f"⚠️ No user_id found for session {session_id}")
            session_data["errors"][product_id] = "User ID not found"
            return
        
        # Choose inference method based on available services
        result_image_url = None
        
        try:
            # Try RunPod first (if configured)
            runpod_service = RunPodService()
            
            # Prepare data properly like the working RunPod API
            person_image, mask_image = await _get_current_user_avatar_for_tryon(user_id, "overall")
            cloth_image = await _url_to_base64(product_info.image_url)
            
            payload = {
                "person": person_image,
                "cloth": cloth_image,
                "mask": mask_image,
                "steps": 50,
                "guidance_scale": 2.5,
                "return_dict": True
            }
            
            logger.info(f"📡 Calling RunPod for product {product_id} with properly formatted base64 data")
            session_data["progress"][product_id] = {"status": "runpod_processing", "progress": 50}
            
            # Create job and wait for completion
            job_response = await runpod_service.create_job(payload)
            job_id = job_response.get('id')
            
            if job_id:
                # Poll for completion
                max_attempts = 30  # 5 minutes max
                for attempt in range(max_attempts):
                    await asyncio.sleep(10)  # Wait 10 seconds between polls
                    
                    status_response = await runpod_service.get_job_status(job_id)
                    status = status_response.get('status', '').upper()
                    
                    session_data["progress"][product_id] = {
                        "status": f"runpod_{status.lower()}", 
                        "progress": 50 + (attempt * 1.5)
                    }
                    
                    if status == 'COMPLETED':
                        output = status_response.get('output', {})
                        
                        # Extract result like the working RunPod system
                        base64_image = None
                        if 'output' in output and isinstance(output['output'], dict):
                            base64_image = output['output'].get('output')
                        elif 'output' in output and isinstance(output['output'], str):
                            base64_image = output['output']
                        else:
                            base64_image = (
                                output.get('image_url') or
                                output.get('result_image') or
                                output.get('image') or
                                output.get('base64_image')
                            )
                        
                        if base64_image:
                            # Persist to S3 like the working system
                            result_image_url = await _persist_result_to_s3(job_id, base64_image)
                            logger.info(f"✅ RunPod completed for product {product_id}: {result_image_url}")
                        else:
                            logger.warning(f"⚠️ No image result found for product {product_id}")
                            logger.warning(f"Output structure: {list(output.keys())}")
                            if 'output' in output:
                                logger.warning(f"Nested output keys: {list(output['output'].keys()) if isinstance(output['output'], dict) else type(output['output'])}")
                        break
                    elif status == 'FAILED':
                        error_msg = status_response.get('error', 'RunPod processing failed')
                        logger.error(f"❌ RunPod failed for product {product_id}: {error_msg}")
                        raise Exception(error_msg)
                        
        except Exception as runpod_error:
            logger.warning(f"⚠️ RunPod failed for product {product_id}: {runpod_error}")
            
            # Fallback to Gemini
            try:
                logger.info(f"🤖 Falling back to Gemini for product {product_id}")
                session_data["progress"][product_id] = {"status": "gemini_processing", "progress": 75}
                
                gemini_service = GeminiService()
                # Use same properly formatted data
                person_image, _ = await _get_current_user_avatar_for_tryon(user_id, "overall")
                cloth_image = await _url_to_base64(product_info.image_url)
                
                result_image_url = await gemini_service.generate_try_on_image(
                    person_image,
                    cloth_image
                )
                logger.info(f"✅ Gemini completed for product {product_id}")
                
            except Exception as gemini_error:
                logger.error(f"❌ All inference methods failed for product {product_id}: {gemini_error}")
                # Use placeholder as final fallback
                result_image_url = f"https://via.placeholder.com/400x600?text=Product+{product_id}+Failed"
        
        # Store final result
        session_data["results"][f"product_{product_id}"] = {
            "product_id": product_id,
            "product_name": product_info.name,
            "result_image": result_image_url,
            "status": "success" if result_image_url and not result_image_url.startswith("https://via.placeholder.com") else "failed"
        }
        
        session_data["progress"][product_id] = {"status": "completed", "progress": 100}
        logger.info(f"🎉 Product {product_id} processing completed")
        
    except Exception as e:
        logger.error(f"❌ Error processing product {product_id}: {str(e)}")
        session_data = session_storage.get(session_id)
        if session_data:
            session_data["errors"][product_id] = str(e)
            session_data["progress"][product_id] = {"status": "failed", "progress": 0}

async def monitor_session_completion(session_id: str, total_products: int):
    """Monitor when all products are processed and update session status"""
    try:
        max_wait = 300  # 5 minutes timeout
        waited = 0
        
        while waited < max_wait:
            await asyncio.sleep(5)
            waited += 5
            
            session_data = session_storage.get(session_id)
            if not session_data:
                break
                
            completed_count = len(session_data.get("results", {}))
            error_count = len(session_data.get("errors", {}))
            
            if completed_count + error_count >= total_products:
                session_data["status"] = "completed"
                logger.info(f"✅ Session {session_id} completed: {completed_count} successful, {error_count} failed")
                break
                
    except Exception as e:
        logger.error(f"❌ Error monitoring session {session_id}: {str(e)}")

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
    """Get virtual try-on status (without slash) - same as main endpoint"""
    return await get_try_on_status(session_id, current_user)

@router.get("/{session_id}/status/", response_model=TryOnSessionResponse)
async def get_try_on_status(
    session_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get virtual try-on status with real-time progress"""
    try:
        session_data = session_storage.get(session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Return live results and status 
        session_status = session_data.get("status", "processing")
        results = session_data.get("results", {})
        progress_info = session_data.get("progress", {})
        errors = session_data.get("errors", {})
        
        # Calculate overall progress
        total_products = len(session_data.get("product_ids", []))
        completed_products = len(results) + len(errors)
        overall_progress = (completed_products / total_products * 100) if total_products > 0 else 0
        
        # Build status message
        if session_status == "completed":
            success_count = len([r for r in results.values() if r.get("status") == "success"])
            failed_count = len(errors) + len([r for r in results.values() if r.get("status") == "failed"])
            message = f"Essayage terminé: {success_count} réussi(s), {failed_count} échoué(s)"
        elif session_status == "processing":
            in_progress = [p for p in progress_info.values() if p.get("status") not in ["completed", "failed"]]
            message = f"Traitement en cours... {completed_products}/{total_products} terminé(s)"
        else:
            message = f"Statut: {session_status}"
        
        logger.info(f"📊 Session {session_id} status: {session_status}, progress: {overall_progress:.1f}%, results: {len(results)}")
        
        return TryOnSessionResponse(
            session_id=session_id,
            status=session_status,
            results=results,
            message=message
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting status for session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


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
