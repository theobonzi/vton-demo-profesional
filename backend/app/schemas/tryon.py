from pydantic import BaseModel, EmailStr
from typing import Dict, Optional, List

class ProductInfo(BaseModel):
    id: int
    name: str
    price: str
    image_url: str
    description: Optional[str] = None

class TryOnRequest(BaseModel):
    person_image_url: str
    product_ids: List[int]
    products_info: Optional[List[ProductInfo]] = None  # Informations des produits sélectionnés
    session_id: Optional[str] = None
    email: Optional[EmailStr] = None

class TryOnResult(BaseModel):
    product_id: int
    product_name: str
    product_description: Optional[str] = None
    product_price: Optional[str] = None
    result_image: Optional[str] = None
    error: Optional[str] = None
    status: str  # 'success' | 'failed'

class TryOnResponse(BaseModel):
    session_id: str
    status: str  # 'pending' | 'processing' | 'completed' | 'failed'
    message: str
    results: Optional[Dict[str, TryOnResult]] = None
    error_message: Optional[str] = None

class TryOnSessionResponse(BaseModel):
    session_id: str
    status: str  # 'pending' | 'processing' | 'completed' | 'failed'
    results: Optional[Dict[str, TryOnResult]] = None
    message: str
    error_message: Optional[str] = None
