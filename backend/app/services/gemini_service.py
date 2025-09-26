import asyncio
import logging
import random
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import httpx
import base64
from typing import Dict, Any, Optional
from app.config import settings


logger = logging.getLogger(__name__)


class GeminiService:
    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        self.model = settings.gemini_image_model
        self.timeout = 120.0
        self.generation_config = {
            "temperature": 0.1,
            "maxOutputTokens": 1024
        }
        self.safety_settings = [
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_CIVIC_INTEGRITY", "threshold": "BLOCK_NONE"},
        ]
        self.max_retries = 3
        self.retry_base_delay = 2.0
        self.retry_max_delay = 10.0
        self.retryable_statuses = {429, 500, 502, 503, 504}

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
                "generationConfig": self.generation_config,
                "safetySettings": self.safety_settings
            }

            # Appel à l'API Gemini
            result = await self._post_to_gemini(request_body)

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

    async def enhance_person_image(
        self,
        image_data: str,
        prompt: Optional[str] = None
    ) -> str:
        """Améliorer une photo utilisateur pour un rendu studio"""

        if not prompt:
            prompt = (
                "Refine the provided person photo so it looks like a professional e-commerce studio shot with a pure "
                "white background. Preserve the person's body, clothing, pose, and facial expression exactly. Remove "
                "the existing background and replace it with a seamless pure white (#FFFFFF) backdrop. Apply soft studio "
                "lighting with no harsh shadows. Return only the edited image."
            )

        try:
            inline_data = self._prepare_inline_data(image_data)

            request_body = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {"inlineData": inline_data}
                    ]
                }],
                "generationConfig": self.generation_config,
                "safetySettings": self.safety_settings
            }

            result = await self._post_to_gemini(request_body)

            if result.get("promptFeedback", {}).get("blockReason"):
                raise Exception(f"Gemini blocked the request: {result['promptFeedback']}")

            candidates = result.get("candidates", [])
            if not candidates:
                raise Exception("No candidates returned from Gemini")

            parts = candidates[0].get("content", {}).get("parts", [])
            for part in parts:
                if "inlineData" in part:
                    mime_type = part["inlineData"].get("mimeType", "image/png")
                    image_base64 = part["inlineData"]["data"]
                    return f"data:{mime_type};base64,{image_base64}"

            raise Exception("No image content found in Gemini response")

        except httpx.HTTPError as e:
            raise Exception(f"Gemini API error: {e}")

    async def _download_and_encode_image(self, image_url: str) -> Dict[str, str]:
        """Télécharger une image et la convertir en base64"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(image_url)
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

    def _prepare_inline_data(self, image_data: str) -> Dict[str, str]:
        """Préparer les données inline pour Gemini à partir d'une image base64"""
        if image_data.startswith("data:"):
            header, base64_data = image_data.split(",", 1)
            mime_type = header.split(";")[0].split(":")[1]
        else:
            mime_type = "image/jpeg"
            base64_data = image_data

        return {
            "mimeType": mime_type,
            "data": base64_data
        }

    async def close(self):
        """Fermer le client HTTP"""
        return None

    async def _post_to_gemini(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if not self.api_key:
            raise Exception("Gemini API key is missing")

        url = f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}"
        attempt = 0
        delay = self.retry_base_delay
        last_error: Optional[str] = None

        while attempt < self.max_retries:
            attempt += 1
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(
                        url,
                        headers={"Content-Type": "application/json"},
                        json=payload
                    )

                if response.status_code == 200:
                    return response.json()

                if response.status_code in self.retryable_statuses and attempt < self.max_retries:
                    last_error = f"HTTP {response.status_code}: {response.text[:200]}"
                    wait_time = self._compute_retry_delay(response, delay)
                    logger.warning(
                        "Gemini API rate/availability issue (status %s) attempt %s/%s. Retrying in %.2fs",
                        response.status_code,
                        attempt,
                        self.max_retries,
                        wait_time
                    )
                    await asyncio.sleep(wait_time)
                    delay = min(delay * 2, self.retry_max_delay)
                    continue

                response.raise_for_status()
                return response.json()

            except (httpx.ConnectError, httpx.ReadTimeout, httpx.RemoteProtocolError) as exc:
                if attempt < self.max_retries:
                    wait_time = self._compute_retry_delay(None, delay)
                    logger.warning(
                        "Gemini API network error '%s' attempt %s/%s. Retrying in %.2fs",
                        exc,
                        attempt,
                        self.max_retries,
                        wait_time
                    )
                    await asyncio.sleep(wait_time)
                    delay = min(delay * 2, self.retry_max_delay)
                    continue
                last_error = f"Network error: {exc}"
                raise Exception(f"Gemini network error: {exc}") from exc

            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code if exc.response else "unknown"
                if status in self.retryable_statuses and attempt < self.max_retries:
                    truncated = exc.response.text[:200] if exc.response and exc.response.text else str(exc)
                    last_error = f"HTTP {status}: {truncated}"
                    wait_time = self._compute_retry_delay(exc.response, delay)
                    logger.warning(
                        "Gemini API error status %s attempt %s/%s. Retrying in %.2fs",
                        status,
                        attempt,
                        self.max_retries,
                        wait_time
                    )
                    await asyncio.sleep(wait_time)
                    delay = min(delay * 2, self.retry_max_delay)
                    continue
                raise Exception(f"Gemini API error {status}: {exc.response.text if exc.response else exc}") from exc

        if last_error:
            raise Exception(f"Gemini API request failed after multiple retries. Last error: {last_error}")
        raise Exception("Gemini API request failed after multiple retries")

    def _compute_retry_delay(self, response: Optional[httpx.Response], fallback: float) -> float:
        """Déterminer le délai d'attente avant la prochaine tentative."""
        retry_after = None
        if response is not None:
            retry_after = response.headers.get("Retry-After")

        if retry_after:
            try:
                return float(retry_after)
            except (TypeError, ValueError):
                try:
                    retry_dt = parsedate_to_datetime(retry_after)
                    if retry_dt:
                        now = datetime.now(timezone.utc)
                        if retry_dt.tzinfo is None:
                            retry_dt = retry_dt.replace(tzinfo=timezone.utc)
                        delta = (retry_dt - now).total_seconds()
                        if delta > 0:
                            return min(self.retry_max_delay, delta)
                except (TypeError, ValueError):
                    pass

        jitter = random.uniform(0.5, 1.5)
        return min(self.retry_max_delay, max(1.0, fallback) * jitter)
