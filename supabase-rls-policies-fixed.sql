-- Politiques RLS pour les tables d'inférence (version corrigée) -- Supprimer les politiques existantes si elles existent 
DROP POLICY IF EXISTS "Users can insert their own inference tasks" ON public.inference_task; DROP POLICY IF EXISTS "Users can view their own inference tasks" ON public.inference_task; DROP POLICY IF EXISTS "Users can update their own inference tasks" ON public.inference_task; DROP POLICY IF EXISTS "Users can insert events for their own tasks" ON public.inference_task_event; DROP POLICY IF EXISTS "Users can view events for their own tasks" ON public.inference_task_event; DROP POLICY IF EXISTS "Service role can manage webhook deliveries" ON public.webhook_delivery;

-- Politique pour inference_task (assume user_id is uuid) 
CREATE POLICY "Users can insert their own inference tasks" ON public.inference_task FOR INSERT WITH CHECK (user_id = (SELECT auth.uid())::uuid);

CREATE POLICY "Users can view their own inference tasks" ON public.inference_task FOR SELECT USING (user_id = (SELECT auth.uid())::uuid);

CREATE POLICY "Users can update their own inference tasks" ON public.inference_task FOR UPDATE USING (user_id = (SELECT auth.uid())::uuid) WITH CHECK (user_id = (SELECT auth.uid())::uuid);

-- Politique pour inference_task_event -- Assumes inference_task.id is uuid; inference_task_event.inference_task_id should be compared as uuid 
CREATE POLICY "Users can insert events for their own tasks" ON public.inference_task_event FOR INSERT WITH CHECK ( EXISTS ( SELECT 1 FROM public.inference_task t WHERE t.id = (inference_task_event.inference_task_id)::uuid AND t.user_id = (SELECT auth.uid())::uuid ) );

CREATE POLICY "Users can view events for their own tasks" ON public.inference_task_event FOR SELECT USING ( EXISTS ( SELECT 1 FROM public.inference_task t WHERE t.id = (inference_task_event.inference_task_id)::uuid AND t.user_id = (SELECT auth.uid())::uuid ) );

-- Politique pour webhook_delivery (service role only) 
CREATE POLICY "Service role can manage webhook deliveries" ON public.webhook_delivery FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- Activer RLS sur toutes les tables 
ALTER TABLE public.inference_task ENABLE ROW LEVEL SECURITY; ALTER TABLE public.inference_task_event ENABLE ROW LEVEL SECURITY; ALTER TABLE public.webhook_delivery ENABLE ROW LEVEL SECURITY;