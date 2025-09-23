import httpx
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urlparse
from app.config import settings


class SupabaseService:
    def __init__(self):
        self.url = settings.supabase_url
        self.key = settings.supabase_key
        self.client = httpx.AsyncClient(timeout=30.0)

    def _headers(self) -> Dict[str, str]:
        """Headers communs pour les appels Supabase"""
        return {
            'apikey': self.key,
            'Authorization': f'Bearer {self.key}',
            'Content-Type': 'application/json'
        }

    async def _get_signed_url(self, bucket: str, object_path: str, expires_in: int = 3600) -> Optional[str]:
        """Générer une URL signée pour un fichier Supabase Storage"""
        if not bucket or not object_path:
            return None

        try:
            response = await self.client.post(
                f"{self.url}/storage/v1/object/sign/{bucket}/{object_path}",
                headers=self._headers(),
                json={'expiresIn': expires_in}
            )

            if response.status_code != 200:
                print(f"Erreur génération URL signée: {response.status_code} - {response.text}")
                return None

            data = response.json()
            signed_url = data.get('signedURL')
            if not signed_url:
                return None

            if signed_url.startswith('http'):
                return signed_url

            if not signed_url.startswith('/'):
                signed_url = f"/{signed_url}"

            return f"{self.url}/storage/v1{signed_url}"

        except Exception as e:
            print(f"Erreur lors de la génération de l'URL signée: {e}")
            return None

    @staticmethod
    def _extract_bucket_and_path(original_url: str, key: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
        """Extraire le bucket et le chemin du fichier à partir d'une URL Supabase"""
        if not original_url:
            return None, None

        try:
            parsed = urlparse(original_url)
            path = parsed.path or ''

            if '/storage/v1/object/' not in path:
                return None, None

            suffix = path.split('/storage/v1/object/', 1)[1]
            parts = [part for part in suffix.split('/') if part]

            if not parts:
                return None, None

            if parts[0] in {'sign', 'public'}:
                if len(parts) < 2:
                    return None, None
                bucket = parts[1]
                object_parts = parts[2:]
            else:
                bucket = parts[0]
                object_parts = parts[1:]

            if not object_parts and key:
                object_parts = [key]

            object_path = '/'.join(object_parts) if object_parts else key
            return bucket, object_path

        except Exception as e:
            print(f"Erreur extraction bucket/path: {e}")
            return None, None

    async def _resolve_media_url(self, media: Dict[str, Any]) -> Optional[str]:
        """Résoudre l'URL exploitable pour un média en base"""
        original_url = media.get('original_url')
        if not original_url:
            return None

        storage_provider = (media.get('storage_provider') or '').lower()

        if storage_provider == 'supabase' or '/storage/v1/object/' in original_url:
            bucket, object_path = self._extract_bucket_and_path(original_url, media.get('key'))
            if bucket and object_path:
                signed_url = await self._get_signed_url(bucket, object_path)
                if signed_url:
                    return signed_url

                # Fallback: tenter une URL publique si le bucket est public
                try:
                    return f"{self.url}/storage/v1/object/public/{bucket}/{object_path}"
                except Exception:
                    pass

        return original_url

    async def _enrich_media_with_urls(self, items: List[Dict[str, Any]]) -> None:
        """Ajouter des URLs résolues aux médias associés aux items"""
        for item in items:
            media_list = item.get('media') or []
            for media in media_list:
                resolved_url = await self._resolve_media_url(media)
                if resolved_url:
                    media['resolved_url'] = resolved_url

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
                    headers=self._headers(),
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
                headers=self._headers(),
                params=query_params
            )

            if response.status_code != 200:
                raise Exception(f"Erreur Supabase: {response.status_code} - {response.text}")

            items = response.json()

            # Résoudre les URLs des médias pour chaque item
            await self._enrich_media_with_urls(items)

            # Récupérer les marques
            brands_response = await self.client.get(
                f"{self.url}/rest/v1/brands",
                headers=self._headers(),
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
                headers=self._headers(),
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
                headers=self._headers(),
                params={
                    'select': '*,brand:brands(id,name,created_at),media:item_media(*)',
                    'id': f'eq.{item_id}'
                }
            )

            if response.status_code == 200:
                items = response.json()
                await self._enrich_media_with_urls(items)
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

        if main_media:
            if main_media.get('resolved_url'):
                return main_media['resolved_url']
            if main_media.get('original_url'):
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
