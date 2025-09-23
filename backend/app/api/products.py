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


@router.get("", response_model=List[dict])
async def get_products(
    brand: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    limit: int = Query(20, le=500),
    skip: int = Query(0, ge=0),
):
    """Récupérer la liste des produits avec filtres depuis Supabase"""
    supabase_service = SupabaseService()
    try:
        # Récupérer les données depuis Supabase
        result = await supabase_service.get_items(
            brand=brand,
            gender=gender,
            limit=limit,
            offset=skip
        )
        
        # Convertir vers le format attendu
        products = [
            supabase_service.convert_to_product(item) 
            for item in result['items']
        ]
        return products
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await supabase_service.close()


@router.get("/brands")
async def get_brands():
    """Récupérer la liste des marques depuis Supabase"""
    supabase_service = SupabaseService()
    try:
        brands = await supabase_service.get_brands()
        return [brand['name'] for brand in brands]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await supabase_service.close()


@router.get("/categories")
async def get_categories():
    """Récupérer la liste des catégories"""
    # Pour l'instant, retourner des catégories par défaut
    # Vous pouvez adapter selon vos données Supabase
    return ["tops", "bottoms", "one-pieces", "accessories"]


@router.get("/{product_id}", response_model=dict)
async def get_product(product_id: int):
    """Récupérer un produit par ID depuis Supabase"""
    supabase_service = SupabaseService()
    try:
        # Convertir l'ID int vers UUID (approximation)
        # Dans un vrai projet, vous devriez mapper les IDs
        item_id = f"{product_id:08x}-0000-4000-8000-000000000000"
        
        item = await supabase_service.get_item_by_id(item_id)
        
        if not item:
            raise HTTPException(status_code=404, detail="Product not found")
        
        return supabase_service.convert_to_product(item)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await supabase_service.close()
