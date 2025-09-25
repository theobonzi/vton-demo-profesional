from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from app.config import settings
from app.api import api_router
from app.services.metrics_service import get_metrics_response
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

# Health check RunPod pour vérifier la connectivité
@app.get("/health/runpod")
async def runpod_health_check():
    """Vérification de l'état de la connexion RunPod"""
    import httpx
    import time
    
    if not settings.runpod_api_token or not settings.runpod_vto_endpoint:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": "Configuration RunPod manquante",
                "runpod_configured": False
            }
        )
    
    try:
        start_time = time.time()
        
        # Test de connectivité basique avec timeout court
        async with httpx.AsyncClient(timeout=5.0) as client:
            headers = {"Authorization": f"Bearer {settings.runpod_api_token}"}
            
            # Tenter de récupérer les informations de l'endpoint
            url = f"https://api.runpod.ai/v2/{settings.runpod_vto_endpoint}"
            response = await client.get(url, headers=headers)
            
            latency = round((time.time() - start_time) * 1000, 2)  # ms
            
            if response.status_code == 200:
                endpoint_data = response.json()
                return {
                    "status": "healthy",
                    "runpod_configured": True,
                    "endpoint_id": settings.runpod_vto_endpoint,
                    "endpoint_status": endpoint_data.get("status", "unknown"),
                    "latency_ms": latency,
                    "api_reachable": True
                }
            else:
                return JSONResponse(
                    status_code=503,
                    content={
                        "status": "degraded",
                        "runpod_configured": True,
                        "endpoint_id": settings.runpod_vto_endpoint,
                        "api_reachable": True,
                        "http_status": response.status_code,
                        "latency_ms": latency,
                        "error": f"HTTP {response.status_code}"
                    }
                )
                
    except httpx.TimeoutException:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "runpod_configured": True,
                "api_reachable": False,
                "error": "Timeout de connexion RunPod (>5s)"
            }
        )
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "runpod_configured": True,
                "api_reachable": False,
                "error": f"Erreur de connexion: {str(e)}"
            }
        )

# Endpoint Prometheus metrics
@app.get("/metrics")
async def metrics():
    """Métriques Prometheus pour monitoring"""
    content, content_type = get_metrics_response()
    return Response(content=content, media_type=content_type)

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
