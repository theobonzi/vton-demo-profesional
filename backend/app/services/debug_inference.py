"""
Script de diagnostic pour les tâches d'inférence VTO
Usage: python -m app.services.debug_inference <task_id>
"""
import asyncio
import json
from typing import Dict, Any
from app.services.supabase_service import SupabaseService
from app.services.inference_service import InferenceService
from app.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class InferenceDebugger:
    def __init__(self):
        self.supabase_service = SupabaseService()
        self.inference_service = InferenceService()

    async def debug_task(self, task_id: str):
        """Diagnostic complet d'une tâche d'inférence"""
        print(f"\n🔍 DIAGNOSTIC TÂCHE: {task_id}")
        print("=" * 60)

        # 1. Vérifier la tâche principale
        await self._check_main_task(task_id)
        
        # 2. Vérifier les événements
        await self._check_task_events(task_id)
        
        # 3. Vérifier les webhooks
        await self._check_webhooks(task_id)
        
        # 4. Vérifier la configuration
        await self._check_configuration()

    async def _check_main_task(self, task_id: str):
        """Vérifier l'état de la tâche principale"""
        print("\n📋 TÂCHE PRINCIPALE:")
        try:
            result = self.supabase_service.client.table('inference_task').select('*').eq('id', task_id).execute()
            
            if not result.data:
                print(f"❌ Tâche {task_id} introuvable!")
                return
            
            task = result.data[0]
            print(f"✅ Task ID: {task['id']}")
            print(f"📊 Status: {task['status']}")
            print(f"📈 Progress: {task.get('progress', 0)}%")
            print(f"🎯 Job ID: {task.get('job_id', 'N/A')}")
            print(f"🔗 Endpoint: {task.get('endpoint_id', 'N/A')}")
            
            if task.get('output'):
                output = json.loads(task['output']) if isinstance(task['output'], str) else task['output']
                print(f"📤 Output: {json.dumps(output, indent=2)}")
            else:
                print("📤 Output: Aucun")
                
            if task.get('error_message'):
                print(f"❌ Error: {task['error_message']}")
                
            print(f"🕐 Created: {task.get('created_at')}")
            print(f"🕐 Updated: {task.get('updated_at')}")
            
        except Exception as e:
            print(f"❌ Erreur lors de la vérification de la tâche: {e}")

    async def _check_task_events(self, task_id: str):
        """Vérifier les événements de la tâche"""
        print("\n📨 ÉVÉNEMENTS:")
        try:
            result = self.supabase_service.client.table('inference_task_event').select('*').eq('inference_task_id', task_id).order('created_at').execute()
            
            if not result.data:
                print("❌ Aucun événement trouvé!")
                return
            
            for i, event in enumerate(result.data, 1):
                payload = json.loads(event['payload']) if isinstance(event['payload'], str) else event['payload']
                print(f"  {i}. [{event['event_type']}] {event['created_at']}")
                print(f"     Payload: {json.dumps(payload, indent=6)}")
                
        except Exception as e:
            print(f"❌ Erreur lors de la vérification des événements: {e}")

    async def _check_webhooks(self, task_id: str):
        """Vérifier les webhooks reçus"""
        print("\n🎣 WEBHOOKS:")
        try:
            # Récupérer d'abord le job_id
            task_result = self.supabase_service.client.table('inference_task').select('job_id').eq('id', task_id).execute()
            
            if not task_result.data or not task_result.data[0].get('job_id'):
                print("❌ Aucun job_id trouvé pour cette tâche!")
                return
                
            job_id = task_result.data[0]['job_id']
            print(f"🎯 Job ID à rechercher: {job_id}")
            
            result = self.supabase_service.client.table('webhook_delivery').select('*').eq('job_id', job_id).order('created_at').execute()
            
            if not result.data:
                print("❌ Aucun webhook reçu pour ce job_id!")
                print(f"🔍 Webhook URL attendue: {settings.public_base_url}/api/v1/inference_tasks/webhook")
                return
            
            for i, webhook in enumerate(result.data, 1):
                payload = json.loads(webhook['payload']) if isinstance(webhook['payload'], str) else webhook['payload']
                print(f"  {i}. Job: {webhook['job_id']}")
                print(f"     Processed: {'✅' if webhook['processed'] else '❌'}")
                print(f"     Created: {webhook['created_at']}")
                print(f"     Payload: {json.dumps(payload, indent=6)}")
                
        except Exception as e:
            print(f"❌ Erreur lors de la vérification des webhooks: {e}")

    async def _check_configuration(self):
        """Vérifier la configuration"""
        print("\n⚙️ CONFIGURATION:")
        
        configs = {
            "RunPod API Token": "✅" if settings.runpod_api_token else "❌",
            "RunPod VTO Endpoint": settings.runpod_vto_endpoint or "❌",
            "Public Base URL": settings.public_base_url,
            "Webhook Secret": "✅" if settings.runpod_webhook_secret else "❌",
            "S3 Bucket": settings.s3_bucket_name,
            "AWS Keys": "✅" if settings.aws_access_key_id and settings.aws_secret_access_key else "❌"
        }
        
        for key, value in configs.items():
            print(f"  {key}: {value}")

    async def simulate_webhook(self, job_id: str, status: str = "COMPLETED", result_url: str = None):
        """Simuler un webhook pour tester"""
        print(f"\n🧪 SIMULATION WEBHOOK: {job_id}")
        
        webhook_data = {
            "id": job_id,
            "status": status.upper(),
        }
        
        if status.upper() == "COMPLETED" and result_url:
            webhook_data["output"] = {
                "image_url": result_url,
                "result_image": result_url
            }
        elif status.upper() == "FAILED":
            webhook_data["error"] = "Test simulation error"
            
        try:
            await self.inference_service.handle_webhook(job_id, webhook_data)
            print("✅ Webhook simulé avec succès!")
        except Exception as e:
            print(f"❌ Erreur simulation webhook: {e}")

# Fonction helper pour le CLI
async def debug_task_cli(task_id: str):
    debugger = InferenceDebugger()
    await debugger.debug_task(task_id)

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python -m app.services.debug_inference <task_id>")
        sys.exit(1)
    
    task_id = sys.argv[1]
    asyncio.run(debug_task_cli(task_id))