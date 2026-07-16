-- Create system_logs table for real-time tracking
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_warning BOOLEAN DEFAULT false,
    player_id UUID,
    username TEXT
);

-- Enable RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (so players can log their own entries)
CREATE POLICY "Allow public insert" ON public.system_logs
    FOR INSERT WITH CHECK (true);

-- Allow everyone to read (for the admin dashboard)
CREATE POLICY "Allow public read" ON public.system_logs
    FOR SELECT USING (true);

-- Enable Realtime for the table
-- Run this in your Supabase SQL Editor:
-- ALTER PUBLICATION supabase_realtime ADD TABLE system_logs;
