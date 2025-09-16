import smtplib
from email.message import EmailMessage
from typing import Optional
from app.config import settings


class EmailService:
    def __init__(self):
        self.host = settings.smtp_host
        self.port = settings.smtp_port
        self.username = settings.smtp_user
        self.password = settings.smtp_password
        self.from_email = settings.smtp_from
        self.use_tls = settings.smtp_use_tls
        self.use_ssl = settings.smtp_use_ssl

    def send_email(self, to_email: str, subject: str, html_body: str, text_body: Optional[str] = None):
        if not all([self.host, self.port, self.from_email]):
            raise RuntimeError("SMTP non configuré. Définissez SMTP_HOST/PORT/FROM dans l'environnement.")

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = self.from_email
        msg["To"] = to_email
        if text_body:
            msg.set_content(text_body)
        msg.add_alternative(html_body, subtype="html")

        if self.use_ssl:
            with smtplib.SMTP_SSL(self.host, self.port) as server:
                if self.username and self.password:
                    server.login(self.username, self.password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(self.host, self.port) as server:
                if self.use_tls:
                    server.starttls()
                if self.username and self.password:
                    server.login(self.username, self.password)
                server.send_message(msg)

