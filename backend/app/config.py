from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Supabase Configuration
    supabase_url: str = "https://pzqzhljhfistuwxcjzjs.supabase.co"
    supabase_key: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6cXpobGpoZmlzdHV3eGNqempzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3OTM4OTUsImV4cCI6MjA3MTM2OTg5NX0.AyGBeK2rJMjrWxSnMaFZ5C-5myW9r5m2D4a-LIEubpk"
    
    # API Keys
    fashn_api_key: str
    gemini_api_key: str
    
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
    
    class Config:
        env_file = ".env"


settings = Settings()
