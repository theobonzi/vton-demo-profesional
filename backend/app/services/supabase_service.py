import httpx
from typing import List, Dict, Any, Optional
from app.config import settings


class SupabaseService:
    def __init__(self):
        self.url = settings.supabase_url
        self.key = settings.supabase_key
        self.client = httpx.AsyncClient(timeout=30.0)

    async def get_items(
        self, 
        brand: Optional[str] = None,
        gender: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Récupérer les items depuis Supabase"""
        try:
            # Construire la query
            query_params = {
                'select': '*,brand:brands(id,name,created_at),media:item_media(*)',
                'is_active': 'eq.true',
                'order': 'created_at.desc',
                'limit': str(limit),
                'offset': str(offset)
            }

            if brand:
                # D'abord récupérer l'ID de la marque
                brand_response = await self.client.get(
                    f"{self.url}/rest/v1/brands",
                    headers={
                        'apikey': self.key,
                        'Authorization': f'Bearer {self.key}',
                        'Content-Type': 'application/json'
                    },
                    params={'name': f'eq.{brand}', 'select': 'id'}
                )
                
                if brand_response.status_code == 200:
                    brand_data = brand_response.json()
                    if brand_data:
                        query_params['brand_id'] = f'eq.{brand_data[0]["id"]}'
                    else:
                        return {'items': [], 'total': 0, 'brands': []}

            if gender:
                query_params['gender'] = f'eq.{gender}'

            # Récupérer les items
            response = await self.client.get(
                f"{self.url}/rest/v1/items",
                headers={
                    'apikey': self.key,
                    'Authorization': f'Bearer {self.key}',
                    'Content-Type': 'application/json'
                },
                params=query_params
            )

            if response.status_code != 200:
                raise Exception(f"Erreur Supabase: {response.status_code} - {response.text}")

            items = response.json()

            # Récupérer les marques
            brands_response = await self.client.get(
                f"{self.url}/rest/v1/brands",
                headers={
                    'apikey': self.key,
                    'Authorization': f'Bearer {self.key}',
                    'Content-Type': 'application/json'
                },
                params={'select': '*', 'order': 'name'}
            )

            brands = brands_response.json() if brands_response.status_code == 200 else []

            return {
                'items': items,
                'total': len(items),
                'brands': brands
            }

        except Exception as e:
            print(f"Erreur dans get_items: {e}")
            return {'items': [], 'total': 0, 'brands': []}

    async def get_brands(self) -> List[Dict[str, Any]]:
        """Récupérer toutes les marques"""
        try:
            response = await self.client.get(
                f"{self.url}/rest/v1/brands",
                headers={
                    'apikey': self.key,
                    'Authorization': f'Bearer {self.key}',
                    'Content-Type': 'application/json'
                },
                params={'select': '*', 'order': 'name'}
            )

            if response.status_code == 200:
                return response.json()
            return []

        except Exception as e:
            print(f"Erreur dans get_brands: {e}")
            return []

    async def get_item_by_id(self, item_id: str) -> Optional[Dict[str, Any]]:
        """Récupérer un item par son ID"""
        try:
            response = await self.client.get(
                f"{self.url}/rest/v1/items",
                headers={
                    'apikey': self.key,
                    'Authorization': f'Bearer {self.key}',
                    'Content-Type': 'application/json'
                },
                params={
                    'select': '*,brand:brands(id,name,created_at),media:item_media(*)',
                    'id': f'eq.{item_id}'
                }
            )

            if response.status_code == 200:
                items = response.json()
                return items[0] if items else None
            return None

        except Exception as e:
            print(f"Erreur dans get_item_by_id: {e}")
            return None

    def get_main_image_url(self, item: Dict[str, Any]) -> Optional[str]:
        """Obtenir l'URL de l'image principale d'un item"""
        media = item.get('media', [])
        if not media:
            return None

        # Chercher l'image avec le rôle 'main'
        main_media = next((m for m in media if m.get('role') == 'main'), None)
        if not main_media:
            # Fallback: première image disponible
            main_media = media[0] if media else None

        if main_media and main_media.get('original_url'):
            return main_media['original_url']

        return None

    def convert_to_product(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """Convertir un item Supabase vers le format Product"""
        main_image_url = self.get_main_image_url(item)
        
        return {
            'id': int(item['id'].replace('-', '')[:8], 16),  # Convertir UUID en int pour compatibilité
            'name': item['name'],
            'brand': item.get('brand', {}).get('name', 'Unknown'),
            'category': 'tops',  # Par défaut, à adapter selon vos données
            'price': item['price_cents'] / 100,
            'description': item.get('description'),
            'image_url': main_image_url or '/placeholder.svg',
            'api_image_url': main_image_url or '/placeholder.svg',
            'gender': item.get('gender', 'unisex'),
            'is_active': item.get('is_active', True),
            'created_at': item.get('created_at', '')
        }

    async def close(self):
        """Fermer le client HTTP"""
        await self.client.aclose()
