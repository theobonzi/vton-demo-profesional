from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProductCreate(BaseModel):
    name: str
    brand: str
    category: str
    price: float
    description: Optional[str] = None
    image_url: str
    api_image_url: str
    gender: str


class ProductResponse(BaseModel):
    id: int
    name: str
    brand: str
    category: str
    price: float
    description: Optional[str]
    image_url: str
    api_image_url: str
    gender: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
