-- Create admin_tasks table for HITL orchestration
CREATE TABLE IF NOT EXISTS public.admin_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type TEXT NOT NULL, -- 'iebc_verification', 'coord_correction', 'geocode_audit'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'awaiting_approval', 'completed', 'failed'
    params JSONB DEFAULT '{}',
    proposed_changes JSONB DEFAULT '[]',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id)
);

-- Create admin_task_logs for real-time streaming
CREATE TABLE IF NOT EXISTS public.admin_task_logs (
    id BIGSERIAL PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.admin_tasks(id) ON DELETE CASCADE,
    level TEXT NOT NULL DEFAULT 'info', -- 'info', 'warn', 'error', 'step', 'success'
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.admin_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_task_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can interact with these tables
-- Assuming is_admin column in core_team or similar
CREATE POLICY "Admins can do everything on admin_tasks"
    ON public.admin_tasks
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.core_team
            WHERE core_team.user_id = auth.uid()
            AND core_team.is_admin = true
        )
    );

CREATE POLICY "Admins can do everything on admin_task_logs"
    ON public.admin_task_logs
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.core_team
            WHERE core_team.user_id = auth.uid()
            AND core_team.is_admin = true
        )
    );

-- Enable Realtime for logs
ALTER TABLE public.admin_task_logs REPLICA IDENTITY FULL;
-- Add to supabase_realtime publication
-- Note: This requires manual execution or a specific Supabase SQL snippet if not done via dashboard
-- DO NOT include ALTER PUBLICATION in migrations usually as it might fail if publication doesn't exist
