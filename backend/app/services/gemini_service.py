import httpx
import base64
from typing import Dict, Any, List
from app.config import settings


class GeminiService:
    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        self.client = httpx.AsyncClient(timeout=60.0)

    async def generate_try_on_image(
        self, 
        person_image_url: str, 
        garment_image_url: str,
        prompt: str = None
    ) -> str:
        """Générer une image d'essayage virtuel avec Gemini"""
        
        if not prompt:
            prompt = """
Create a realistic fashion photo by dressing the person from the first image in the exact clothing from the second image.

CRITICAL REQUIREMENTS:
- Preserve the person's face, identity, and body proportions exactly
- Replace ONLY the clothing with the garment from the second image
- Ensure perfect fit and natural draping of the new clothing
- Maintain the original pose and facial expression
- Use clean white studio background
- Apply professional fashion photography lighting
- Generate photorealistic quality suitable for e-commerce
- No visible editing artifacts or distortions

Output: A professional fashion model photo showing this person wearing the new garment.
            """.strip()

        try:
            # Télécharger et encoder les images
            person_base64 = await self._download_and_encode_image(person_image_url)
            garment_base64 = await self._download_and_encode_image(garment_image_url)

            # Préparer la requête
            request_body = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {"inlineData": person_base64},
                        {"inlineData": garment_base64}
                    ]
                }],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 1024
                },
                "safetySettings": [
                    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
                    {"category": "HARM_CATEGORY_CIVIC_INTEGRITY", "threshold": "BLOCK_NONE"},
                ]
            }

            # Appel à l'API Gemini
            response = await self.client.post(
                f"{self.base_url}/models/gemini-2.5-flash-image-preview:generateContent?key={self.api_key}",
                headers={"Content-Type": "application/json"},
                json=request_body
            )

            response.raise_for_status()
            result = response.json()

            # Vérifier les blocages de sécurité
            if result.get("promptFeedback", {}).get("blockReason"):
                raise Exception(f"Gemini blocked the request: {result['promptFeedback']}")

            # Extraire l'image générée
            candidates = result.get("candidates", [])
            if not candidates:
                raise Exception("No candidates returned from Gemini")

            parts = candidates[0].get("content", {}).get("parts", [])
            for part in parts:
                if "inlineData" in part:
                    mime_type = part["inlineData"].get("mimeType", "image/png")
                    image_data = part["inlineData"]["data"]
                    return f"data:{mime_type};base64,{image_data}"

            raise Exception("No image content found in Gemini response")

        except httpx.HTTPError as e:
            raise Exception(f"Gemini API error: {e}")

    async def _download_and_encode_image(self, image_url: str) -> Dict[str, str]:
        """Télécharger une image et la convertir en base64"""
        try:
            response = await self.client.get(image_url)
            response.raise_for_status()
            
            content_type = response.headers.get("content-type", "image/jpeg")
            image_data = response.content
            base64_data = base64.b64encode(image_data).decode("utf-8")
            
            return {
                "mimeType": content_type,
                "data": base64_data
            }
        except httpx.HTTPError as e:
            raise Exception(f"Error downloading image: {e}")

    async def close(self):
        """Fermer le client HTTP"""
        await self.client.aclose()
