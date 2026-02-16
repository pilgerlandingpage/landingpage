-- Create user_feedback table for Pilger AI feedback collection
CREATE TABLE IF NOT EXISTS public.user_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'outro' CHECK (type IN ('duvida', 'sugestao', 'bug', 'elogio', 'outro')),
    content TEXT NOT NULL,
    conversation_log TEXT,
    user_name TEXT,
    status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'lido', 'resolvido')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Allow service role to do everything (API routes use admin client)
CREATE POLICY "service_role_all" ON public.user_feedback
    FOR ALL
    USING (true)
    WITH CHECK (true);
