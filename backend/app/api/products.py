from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from app.services.supabase_service import SupabaseService
from app.config import settings

router = APIRouter()


@router.get("/debug")
async def debug_config():
    """Endpoint de debug pour vérifier la configuration"""
    return {
        "default_brand": settings.default_brand,
        "app_name": settings.app_name,
        "debug": settings.debug
    }


@router.get("/", response_model=List[dict])
async def get_products(
    brand: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    skip: int = Query(0, ge=0),
):
    """Récupérer la liste des produits avec filtres depuis Supabase"""
    try:
        supabase_service = SupabaseService()
        
        # Si DEFAULT_BRAND est défini, l'utiliser comme filtre par défaut
        effective_brand = brand
        if settings.default_brand and not brand:
            effective_brand = settings.default_brand
        
        # Récupérer les données depuis Supabase
        result = await supabase_service.get_items(
            brand=effective_brand,
            gender=gender,
            limit=limit,
            offset=skip
        )
        
        # Convertir vers le format attendu
        products = [
            supabase_service.convert_to_product(item) 
            for item in result['items']
        ]
        
        await supabase_service.close()
        return products
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/brands")
async def get_brands():
    """Récupérer la liste des marques depuis Supabase"""
    try:
        supabase_service = SupabaseService()
        
        # Si DEFAULT_BRAND est défini, ne retourner que cette marque
        if settings.default_brand:
            # Vérifier que la marque existe dans Supabase
            brands = await supabase_service.get_brands()
            brand_exists = any(brand['name'] == settings.default_brand for brand in brands)
            
            if brand_exists:
                return [settings.default_brand]
            else:
                # Si la marque n'existe pas, retourner toutes les marques
                return [brand['name'] for brand in brands]
        else:
            # Pas de marque par défaut, retourner toutes les marques
            brands = await supabase_service.get_brands()
            return [brand['name'] for brand in brands]
        
        await supabase_service.close()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/categories")
async def get_categories():
    """Récupérer la liste des catégories"""
    # Pour l'instant, retourner des catégories par défaut
    # Vous pouvez adapter selon vos données Supabase
    return ["tops", "bottoms", "one-pieces", "accessories"]


@router.get("/{product_id}", response_model=dict)
async def get_product(product_id: int):
    """Récupérer un produit par ID depuis Supabase"""
    try:
        supabase_service = SupabaseService()
        
        # Convertir l'ID int vers UUID (approximation)
        # Dans un vrai projet, vous devriez mapper les IDs
        item_id = f"{product_id:08x}-0000-4000-8000-000000000000"
        
        item = await supabase_service.get_item_by_id(item_id)
        await supabase_service.close()
        
        if not item:
            raise HTTPException(status_code=404, detail="Product not found")
        
        return supabase_service.convert_to_product(item)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
