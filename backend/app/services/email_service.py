"""Service utilitaire pour l'envoi de résumés d'essayage virtuel."""
from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from typing import Dict, Union

from app.config import settings

logger = logging.getLogger(__name__)

TryOnResultPayload = Dict[str, Union[str, int, None]]


class EmailService:
    """Service responsable de l'envoi des e-mails de synthèse."""

    def __init__(self) -> None:
        self.smtp_host = settings.smtp_host
        self.smtp_port = settings.smtp_port
        self.smtp_username = settings.smtp_username
        self.smtp_password = settings.smtp_password
        self.smtp_sender = settings.smtp_sender
        self.smtp_use_tls = settings.smtp_use_tls

    @property
    def is_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_sender)

    async def send_summary(
        self,
        to_email: str,
        person_image_url: str,
        results: Dict[str, TryOnResultPayload],
    ) -> None:
        """Envoie un e-mail contenant le résumé des résultats."""

        if not self.is_configured:
            logger.info("SMTP non configuré. Envoi de l'email ignoré.")
            return

        message = EmailMessage()
        message["Subject"] = "Résumé de votre session d'essayage virtuel"
        message["From"] = self.smtp_sender
        message["To"] = to_email

        text_content = self._build_text_content(results)
        html_content = self._build_html_content(person_image_url, results)

        message.set_content(text_content)
        message.add_alternative(html_content, subtype="html")

        await asyncio.to_thread(self._send_email, message)

    def _send_email(self, message: EmailMessage) -> None:
        try:
            with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=30) as server:
                if self.smtp_use_tls:
                    server.starttls()
                if self.smtp_username and self.smtp_password:
                    server.login(self.smtp_username, self.smtp_password)
                server.send_message(message)
        except Exception as exc:
            logger.error("Échec de l'envoi de l'email de résumé: %s", exc)

    def _build_text_content(self, results: Dict[str, TryOnResultPayload]) -> str:
        lines = [
            "Bonjour,",
            "",
            "Voici le résumé de votre session d'essayage virtuel:",
            "",
        ]

        for payload in results.values():
            name = payload.get("product_name") or "Produit"
            description = payload.get("product_description") or "Description non disponible"
            price_value = payload.get("product_price")
            price = str(price_value) if price_value else ""

            lines.append(f"- {name}")
            lines.append(f"  Description : {description}")
            if price:
                lines.append(f"  Prix : {price}")
            lines.append("")

        lines.append("À bientôt pour un nouvel essayage !")
        return "\n".join(lines)

    def _build_html_content(
        self,
        person_image_url: str,
        results: Dict[str, TryOnResultPayload],
    ) -> str:
        items_html = []
        for payload in results.values():
            name = payload.get("product_name") or "Produit"
            description = payload.get("product_description") or "Description non disponible"
            price_value = payload.get("product_price")
            price = str(price_value) if price_value else ""
            result_image = payload.get("result_image") or person_image_url

            product_html = f"""
                <div style='margin-bottom:24px;'>
                    <h3 style='margin:0 0 8px 0;font-family:Arial,sans-serif;color:#111;'>{name}</h3>
                    <img src='{result_image}' alt='{name}' style='width:240px;border-radius:8px;display:block;margin-bottom:8px;' />
                    <p style='margin:0 0 4px 0;font-family:Arial,sans-serif;color:#444;'>{description}</p>
            """
            if price:
                product_html += f"<p style='margin:0;font-family:Arial,sans-serif;color:#666;'>Prix : {price}</p>"
            product_html += "</div>"
            items_html.append(product_html)

        items_markup = "".join(items_html)

        return f"""
            <html>
                <body style='font-family:Arial,sans-serif;background-color:#f8f8f8;padding:24px;'>
                    <div style='max-width:600px;margin:0 auto;background:#ffffff;padding:24px;border-radius:12px;'>
                        <h2 style='margin-top:0;color:#111;'>Résumé de votre session d'essayage virtuel</h2>
                        <p style='color:#444;'>Merci d'avoir utilisé notre service d'essayage virtuel. Voici vos looks générés :</p>
                        {items_markup}
                        <p style='color:#666;'>À très vite pour un nouvel essayage !</p>
                    </div>
                </body>
            </html>
        """
