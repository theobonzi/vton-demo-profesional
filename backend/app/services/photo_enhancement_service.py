import logging
from typing import Optional

from app.services.gemini_service import GeminiService

logger = logging.getLogger(__name__)

DEFAULT_STUDIO_PROMPT = (
    "Retouch the provided person photo into a premium e-commerce studio portrait. Maintain the subject's exact pose, "
    "body shape, garments, skin tone, accessories, and facial expression. Remove the existing environment and replace "
    "it with a seamless pure white (#FFFFFF) cyclorama background. Light the scene with soft diffused key and fill lights "
    "for balanced illumination, no harsh shadows. Deliver a tack-sharp, high-resolution result suitable for product detail "
    "zooming."
)


class PhotoEnhancementService:
    def __init__(self, gemini_service: Optional[GeminiService] = None):
        self.gemini_service = gemini_service or GeminiService()

    async def enhance_to_studio(self, image_data: str, prompt_override: Optional[str] = None) -> str:
        prompt = prompt_override or DEFAULT_STUDIO_PROMPT
        logger.info("Enhancing user photo with Gemini model for studio output")
        return await self.gemini_service.enhance_person_image(image_data, prompt)

    async def close(self) -> None:
        await self.gemini_service.close()
