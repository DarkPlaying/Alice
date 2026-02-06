-- FINAL SPADES ACCESS & SCHEMA FIX
-- Run this in Supabase SQL Editor to resolve all 400 errors and redirection issues.

-- 1. Ensure Table Exists
CREATE TABLE IF NOT EXISTS public.spades_game_state (
    id TEXT PRIMARY KEY DEFAULT 'spades_main',
    phase TEXT DEFAULT 'idle',
    current_round INTEGER DEFAULT 0,
    is_paused BOOLEAN DEFAULT false,
    system_start BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT false,
    players JSONB DEFAULT '{}',
    round_data JSONB DEFAULT '{}',
    deck JSONB DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add Missing Columns (Handles the "Schema Mismatch" in Admin Dashboard)
ALTER TABLE public.spades_game_state ADD COLUMN IF NOT EXISTS phase_started_at TIMESTAMPTZ;
ALTER TABLE public.spades_game_state ADD COLUMN IF NOT EXISTS phase_duration_sec INTEGER;
ALTER TABLE public.spades_game_state ADD COLUMN IF NOT EXISTS paused_remaining_sec INTEGER;
ALTER TABLE public.spades_game_state ADD COLUMN IF NOT EXISTS allowed_players TEXT[] DEFAULT '{}';

-- 3. Ensure Initial Row Exists
INSERT INTO public.spades_game_state (id) 
VALUES ('spades_main') 
ON CONFLICT (id) DO NOTHING;

-- 4. Enable Realtime
ALTER publication supabase_realtime ADD TABLE public.spades_game_state;
EXCEPTION WHEN others THEN NULL; -- Ignore if already added

-- 5. Fix RLS (Allow everyone to read/update for now)
ALTER TABLE public.spades_game_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Select" ON public.spades_game_state;
CREATE POLICY "Public Select" ON public.spades_game_state FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Update" ON public.spades_game_state;
CREATE POLICY "Public Update" ON public.spades_game_state FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public Insert" ON public.spades_game_state;
CREATE POLICY "Public Insert" ON public.spades_game_state FOR INSERT WITH CHECK (true);

-- 6. Grant Permissions to Anon
GRANT ALL ON public.spades_game_state TO anon;
GRANT ALL ON public.spades_game_state TO authenticated;
GRANT ALL ON public.spades_game_state TO service_role;
