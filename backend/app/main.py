from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.api import api_router
import logging

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Créer l'application FastAPI
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="API professionnelle pour la démo d'essayage virtuel avec Supabase",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclure les routes API
app.include_router(api_router, prefix="/api/v1")

# Gestionnaire d'erreurs global
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

# Route de santé
@app.get("/health")
async def health_check():
    """Vérification de l'état de l'API"""
    return {
        "status": "healthy",
        "app_name": settings.app_name,
        "version": settings.app_version,
        "database": "Supabase"
    }

# Route racine
@app.get("/")
async def root():
    """Point d'entrée de l'API"""
    return {
        "message": f"Bienvenue sur {settings.app_name}",
        "version": settings.app_version,
        "docs": "/docs",
        "database": "Supabase"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug
    )
