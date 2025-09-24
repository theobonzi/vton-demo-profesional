from pydantic import BaseModel, Field, validator, model_validator
from typing import Dict, Any, Optional, List
from enum import Enum
from datetime import datetime

class InferenceTaskStatus(str, Enum):
    IN_QUEUE = "IN_QUEUE"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"

class InferenceTaskEventType(str, Enum):
    STATE = "STATE"
    PROGRESS = "PROGRESS"
    RESULT = "RESULT"
    ERROR = "ERROR"

# Schémas de requête
class CreateInferenceTaskRequest(BaseModel):
    """Demande de création d'une tâche d'inférence VTO"""
    # Support both URL and base64 approaches for cloth images
    cloth_images: Optional[List[str]] = Field(None, description="Liste des images de vêtements en base64 (avec ou sans prefix data:image/...)")
    cloth_image_urls: Optional[List[str]] = Field(None, description="Liste des URLs des images de vêtements (backend fetch)")
    steps: int = Field(default=50, ge=1, le=100, description="Nombre d'étapes d'inférence")
    guidance_scale: float = Field(default=2.5, ge=0.1, le=20.0, description="Échelle de guidance")
    
    @model_validator(mode='after')
    def validate_cloth_data(self):
        if not self.cloth_images and not self.cloth_image_urls:
            raise ValueError('Either cloth_images or cloth_image_urls must be provided')
        return self
    
    # Données avatar optionnelles - soit images directes soit clés S3
    person_image_data: Optional[str] = Field(None, description="Image de la personne en base64")
    mask_image_data: Optional[str] = Field(None, description="Mask de la personne en base64")
    person_s3_key: Optional[str] = Field(None, description="Clé S3 pour l'image de la personne")
    mask_s3_key: Optional[str] = Field(None, description="Clé S3 pour le mask")

class UpdateInferenceTaskRequest(BaseModel):
    """Demande de mise à jour d'une tâche d'inférence"""
    status: Optional[InferenceTaskStatus] = None
    progress: Optional[float] = Field(None, ge=0.0, le=100.0)
    output: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

# Schémas de réponse
class InferenceTaskResponse(BaseModel):
    """Réponse contenant les détails d'une tâche d'inférence"""
    id: str
    user_id: str
    status: InferenceTaskStatus
    endpoint_id: Optional[str]
    job_id: Optional[str]
    
    # Données d'entrée
    input: Dict[str, Any]
    person_s3_key: Optional[str]
    cloth_s3_key: str
    mask_s3_key: Optional[str]
    
    # Résultats
    output: Optional[Dict[str, Any]]
    error_message: Optional[str]
    progress: float
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]
    canceled_at: Optional[datetime]

    class Config:
        from_attributes = True

class InferenceTaskEventResponse(BaseModel):
    """Réponse contenant un événement de tâche d'inférence"""
    id: int
    inference_task_id: str
    event_type: InferenceTaskEventType
    payload: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True

class CreateInferenceTaskResponse(BaseModel):
    """Réponse de création d'une tâche d'inférence"""
    task_id: str
    status: InferenceTaskStatus
    message: str
    cloth_count: int

class InferenceTaskListResponse(BaseModel):
    """Réponse listant les tâches d'inférence d'un utilisateur"""
    tasks: List[InferenceTaskResponse]
    total: int
    page: int
    limit: int

class InferenceTaskStatusResponse(BaseModel):
    """Réponse de statut simplifié d'une tâche"""
    task_id: str
    status: InferenceTaskStatus
    progress: float
    message: str
    results_count: int = 0
    error_message: Optional[str] = None

# Schémas pour les webhooks Runpod
class RunpodWebhookPayload(BaseModel):
    """Payload reçu du webhook Runpod"""
    id: str
    status: str
    output: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class RunpodWebhookRequest(BaseModel):
    """Requête complète du webhook Runpod"""
    webhook_id: Optional[str] = None
    job_id: str
    status: str
    output: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_time: Optional[int] = None

# Schémas pour l'upload d'images
class S3UploadUrlRequest(BaseModel):
    """Demande d'URL de upload S3 pour une image cloth"""
    filename: str
    content_type: str = "image/jpeg"

class S3UploadUrlResponse(BaseModel):
    """Réponse contenant l'URL de upload S3"""
    upload_url: str
    s3_key: str
    expires_in: int

# Schémas pour les résultats d'inférence
class InferenceResultItem(BaseModel):
    """Résultat d'inférence pour un vêtement"""
    cloth_s3_key: str
    result_s3_key: Optional[str] = None
    result_signed_url: Optional[str] = None
    status: str  # 'success' | 'failed'
    error: Optional[str] = None

class InferenceResultsResponse(BaseModel):
    """Réponse contenant tous les résultats d'une tâche"""
    task_id: str
    status: InferenceTaskStatus
    results: List[InferenceResultItem]
    total_results: int
    successful_results: int
    failed_results: int