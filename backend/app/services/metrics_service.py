import time
import logging
from typing import Dict, Optional
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from functools import wraps

logger = logging.getLogger(__name__)

# Métriques Prometheus selon votre brief de supervision
inference_tasks_total = Counter(
    'inference_tasks_total',
    'Nombre total de tâches d\'inférence créées',
    ['status', 'user_id']
)

inference_task_duration = Histogram(
    'inference_task_duration_seconds',
    'Durée complète d\'une tâche d\'inférence (création → complétion)',
    ['status'],
    buckets=[1, 5, 10, 30, 60, 120, 300, 600, 1200]  # 1s à 20min
)

inference_webhooks_received = Counter(
    'inference_webhooks_received_total',
    'Nombre de webhooks RunPod reçus',
    ['status', 'job_status']
)

inference_webhook_processing_time = Histogram(
    'inference_webhook_processing_seconds',
    'Temps de traitement d\'un webhook',
    buckets=[0.001, 0.01, 0.1, 0.5, 1.0, 2.0, 5.0]
)

inference_runpod_api_calls = Counter(
    'inference_runpod_api_calls_total',
    'Appels API vers RunPod',
    ['endpoint', 'status']
)

inference_runpod_api_duration = Histogram(
    'inference_runpod_api_duration_seconds',
    'Durée des appels API RunPod',
    ['endpoint'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]
)

inference_active_tasks = Gauge(
    'inference_active_tasks',
    'Nombre de tâches d\'inférence actives',
    ['status']
)

inference_polling_requests = Counter(
    'inference_polling_requests_total',
    'Requêtes de polling /status',
    ['user_id', 'task_status']
)

inference_rate_limit_hits = Counter(
    'inference_rate_limit_hits_total',
    'Nombre de fois où le rate limiting est déclenché',
    ['endpoint', 'user_id']
)

# S3 et stockage
inference_s3_operations = Counter(
    'inference_s3_operations_total',
    'Opérations S3',
    ['operation', 'status']  # operation: upload, download, delete
)

inference_s3_transfer_bytes = Counter(
    'inference_s3_transfer_bytes_total',
    'Bytes transférés vers/depuis S3',
    ['operation']
)

class MetricsService:
    """Service de gestion des métriques Prometheus pour l'inférence VTO"""
    
    def __init__(self):
        self.task_start_times: Dict[str, float] = {}
        
    def record_task_created(self, task_id: str, user_id: str):
        """Enregistrer la création d'une tâche"""
        inference_tasks_total.labels(status='created', user_id=user_id).inc()
        self.task_start_times[task_id] = time.time()
        inference_active_tasks.labels(status='IN_QUEUE').inc()
        logger.debug(f"Métriques: Tâche {task_id} créée pour utilisateur {user_id}")
    
    def record_task_status_change(self, task_id: str, old_status: str, new_status: str):
        """Enregistrer un changement de statut"""
        if old_status:
            inference_active_tasks.labels(status=old_status).dec()
        inference_active_tasks.labels(status=new_status).inc()
        logger.debug(f"Métriques: Tâche {task_id} {old_status} → {new_status}")
    
    def record_task_completed(self, task_id: str, user_id: str, final_status: str):
        """Enregistrer la complétion d'une tâche"""
        inference_tasks_total.labels(status=final_status, user_id=user_id).inc()
        inference_active_tasks.labels(status=final_status).dec()
        
        # Enregistrer la durée totale
        start_time = self.task_start_times.pop(task_id, None)
        if start_time:
            duration = time.time() - start_time
            inference_task_duration.labels(status=final_status).observe(duration)
            logger.info(f"Métriques: Tâche {task_id} terminée en {duration:.2f}s avec statut {final_status}")
    
    def record_webhook_received(self, job_id: str, webhook_status: str, job_status: str):
        """Enregistrer la réception d'un webhook"""
        inference_webhooks_received.labels(status=webhook_status, job_status=job_status).inc()
    
    def record_runpod_api_call(self, endpoint: str, status: str, duration: float):
        """Enregistrer un appel API RunPod"""
        inference_runpod_api_calls.labels(endpoint=endpoint, status=status).inc()
        inference_runpod_api_duration.labels(endpoint=endpoint).observe(duration)
    
    def record_polling_request(self, user_id: str, task_status: str):
        """Enregistrer une requête de polling"""
        inference_polling_requests.labels(user_id=user_id, task_status=task_status).inc()
    
    def record_rate_limit_hit(self, endpoint: str, user_id: str):
        """Enregistrer un hit de rate limiting"""
        inference_rate_limit_hits.labels(endpoint=endpoint, user_id=user_id).inc()
    
    def record_s3_operation(self, operation: str, status: str, bytes_transferred: Optional[int] = None):
        """Enregistrer une opération S3"""
        inference_s3_operations.labels(operation=operation, status=status).inc()
        if bytes_transferred:
            inference_s3_transfer_bytes.labels(operation=operation).inc(bytes_transferred)

# Instance globale
metrics_service = MetricsService()

def track_webhook_processing_time(func):
    """Décorateur pour mesurer le temps de traitement des webhooks"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            inference_webhook_processing_time.observe(time.time() - start_time)
            return result
        except Exception as e:
            inference_webhook_processing_time.observe(time.time() - start_time)
            raise
    return wrapper

def track_runpod_api_call(endpoint: str):
    """Décorateur pour mesurer les appels API RunPod"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            status = "success"
            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                status = "error"
                raise
            finally:
                duration = time.time() - start_time
                metrics_service.record_runpod_api_call(endpoint, status, duration)
        return wrapper
    return decorator

def get_metrics_response():
    """Générer la réponse Prometheus metrics"""
    return generate_latest(), CONTENT_TYPE_LATEST