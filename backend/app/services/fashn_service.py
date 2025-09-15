import httpx
import base64
from typing import Dict, Any
from app.config import settings


class FashnService:
    def __init__(self):
        self.api_key = settings.fashn_api_key
        self.base_url = "https://api.fashn.ai/v1"
        self.client = httpx.AsyncClient(timeout=30.0)

    async def remove_background(self, image_base64: str) -> Dict[str, Any]:
        """Supprimer l'arrière-plan d'une image"""
        try:
            response = await self.client.post(
                f"{self.base_url}/run",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model_name": "background-remove",
                    "inputs": {
                        "image": image_base64
                    }
                }
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise Exception(f"FASHN API error: {e}")

    async def run_try_on(
        self, 
        person_image: str, 
        garment_image: str, 
        category: str = "auto"
    ) -> Dict[str, Any]:
        """Exécuter un essayage virtuel"""
        try:
            response = await self.client.post(
                f"{self.base_url}/run",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model_name": "tryon-v1.6",
                    "inputs": {
                        "model_image": person_image,
                        "garment_image": garment_image,
                        "category": category
                    }
                }
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise Exception(f"FASHN API error: {e}")

    async def get_status(self, prediction_id: str) -> Dict[str, Any]:
        """Vérifier le statut d'une prédiction"""
        try:
            response = await self.client.get(
                f"{self.base_url}/predictions/{prediction_id}",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                }
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise Exception(f"FASHN API error: {e}")

    async def wait_for_completion(
        self, 
        prediction_id: str, 
        max_wait_time: int = 60000
    ) -> Dict[str, Any]:
        """Attendre la completion d'une prédiction"""
        import asyncio
        import time
        
        start_time = time.time()
        poll_interval = 2  # secondes
        
        while time.time() - start_time < max_wait_time:
            status = await self.get_status(prediction_id)
            
            if status.get("status") == "completed":
                return status
            elif status.get("status") == "failed":
                raise Exception(f"Prediction failed: {status.get('error', 'Unknown error')}")
            
            await asyncio.sleep(poll_interval)
        
        raise Exception("Timeout: Prediction took too long")

    async def image_to_base64(self, image_url: str) -> str:
        """Convertir une image URL en base64"""
        try:
            response = await self.client.get(image_url)
            response.raise_for_status()
            
            # Déterminer le type MIME
            content_type = response.headers.get("content-type", "image/jpeg")
            
            # Encoder en base64
            image_data = response.content
            base64_data = base64.b64encode(image_data).decode("utf-8")
            
            return f"data:{content_type};base64,{base64_data}"
        except httpx.HTTPError as e:
            raise Exception(f"Error downloading image: {e}")

    async def close(self):
        """Fermer le client HTTP"""
        await self.client.aclose()
