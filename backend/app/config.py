from pydantic_settings import BaseSettings
from typing import Optional
import os
from pathlib import Path


class Settings(BaseSettings):
    # Supabase Configuration
    supabase_url: str
    supabase_key: str
    
    # API Keys
    fashn_api_key: str
    gemini_api_key: str
    gemini_image_model: str = "gemini-2.5-flash-image-preview"
    
    # JWT
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # CORS
    frontend_url: str = "http://localhost:3000"
    
    # Brand Selection
    default_brand: Optional[str] = None
    
    # App
    app_name: str = "VTON Demo Professional"
    app_version: str = "1.0.0"
    debug: bool = True

    # SMTP (for emailing summaries)
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    
    # AWS S3 Configuration (for avatar storage)
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_region: str = "us-east-1"
    s3_bucket_name: str = "vton-avatars"
    s3_custom_domain: Optional[str] = None  # Pour CloudFront ou domaine personnalisé
    
    # RunPod Configuration (simplified - no webhooks)
    runpod_api_token: Optional[str] = None
    runpod_vto_endpoint: Optional[str] = None
    runpod_preprocessing_endpoint: Optional[str] = None

    class Config:
        # Chercher le .env dans le dossier backend (2 niveaux au-dessus)
        backend_root = Path(__file__).parent.parent
        env_file = backend_root / ".env"
        env_file_encoding = 'utf-8'
        case_sensitive = False


settings = Settings()
