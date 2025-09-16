"""Service principal gérant les sessions d'essayage virtuel."""
from __future__ import annotations

import asyncio
import uuid
from typing import Any, Dict, Optional

from app.schemas.tryon import TryOnRequest, TryOnResponse
from app.services.email_service import EmailService
from app.services.fake_service import FakeService


class TryOnService:
    """Orchestre les sessions d'essayage virtuel et leur suivi."""

    _sessions: Dict[str, Dict[str, Any]] = {}

    def __init__(
        self,
        fake_service: Optional[FakeService] = None,
        email_service: Optional[EmailService] = None,
    ) -> None:
        self.fake_service = fake_service or FakeService()
        self.email_service = email_service or EmailService()

    async def process_try_on(self, request: TryOnRequest) -> TryOnResponse:
        """Initialise une nouvelle session d'essayage virtuel."""

        if not request.product_ids:
            raise ValueError("Aucun produit sélectionné")

        if not request.person_image_url:
            raise ValueError("Aucune image de personne fournie")

        session_id = request.session_id or str(uuid.uuid4())
        request_with_session = request.model_copy(update={"session_id": session_id})

        message = (
            f"Essayage virtuel en cours de traitement pour {len(request.product_ids)} produit(s)..."
        )

        loop = asyncio.get_running_loop()
        self._sessions[session_id] = {
            "request": request_with_session,
            "status": "processing",
            "message": message,
            "results": None,
            "error_message": None,
            "created_at": loop.time(),
        }

        processing_delay = min(1.0 + len(request.product_ids) * 0.2, 4.0)
        asyncio.create_task(self._simulate_processing(session_id, processing_delay))

        return TryOnResponse(
            session_id=session_id,
            status="processing",
            message=message,
        )

    async def _simulate_processing(self, session_id: str, delay: float) -> None:
        session = self._sessions.get(session_id)
        if not session:
            return

        request: TryOnRequest = session["request"]
        await asyncio.sleep(delay)

        try:
            results = await self.fake_service.generate_results(
                person_image_url=request.person_image_url,
                product_ids=request.product_ids,
                products_info=request.products_info,
            )
            session["results"] = results
            session["status"] = "completed"
            session["message"] = (
                f"Essayage virtuel terminé avec succès - {len(results)} résultat(s)"
            )
            session["error_message"] = None

            if request.email:
                await self.email_service.send_summary(
                    to_email=request.email,
                    person_image_url=request.person_image_url,
                    results=results,
                )
        except Exception as exc:  # pragma: no cover - log en cas d'échec
            session["status"] = "failed"
            session["message"] = (
                "Une erreur est survenue pendant le traitement de l'essayage virtuel."
            )
            session["error_message"] = str(exc)

    async def get_try_on_status(self, session_id: str) -> Dict[str, Any]:
        """Retourne l'état actuel d'une session d'essayage."""

        session = self._sessions.get(session_id)
        if not session:
            raise KeyError("Session not found")

        return {
            "session_id": session_id,
            "status": session.get("status", "processing"),
            "results": session.get("results"),
            "message": session.get("message", ""),
            "error_message": session.get("error_message"),
        }
*** End File
