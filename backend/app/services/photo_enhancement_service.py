import logging
from typing import Optional

from app.services.gemini_service import GeminiService

logger = logging.getLogger(__name__)

DEFAULT_STUDIO_PROMPT = (
    "Transform this photo into a professional full-body studio mannequin portrait. "
    "Reframe tightly so the subject fills the frame vertically from head to feet"
    "Adjust the stance into a clean mannequin-like fashion pose."
    "Keep the subject’s exact body morphology and proportions intact — do not alter height, width, or shape. "
    "Preserve clothing, textures, colors, skin tone, accessories, and facial expression. "
    "Replace the background with a studio grey/white background, evenly lit with soft diffused studio lighting. "
    "Deliver a sharp, high-resolution image suitable for e-commerce catalogs. "
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
