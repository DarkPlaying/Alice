-- Migration: Create hearts_game_state table for Cross-Reveal mechanics
-- Date: 2026-01-17

-- 1. Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.hearts_game_state (
    id TEXT PRIMARY KEY,
    phase TEXT DEFAULT 'idle', -- idle, briefing, connection, playing, guess, evaluation, completed
    current_round INTEGER DEFAULT 1,
    is_paused BOOLEAN DEFAULT FALSE,
    system_start BOOLEAN DEFAULT FALSE,
    players JSONB DEFAULT '{}'::jsonb, -- { [uid]: { id, username, score, alive, eye_used, role } }
    round_data JSONB DEFAULT '{}'::jsonb, -- { pairings, cards, messages, guesses }
    phase_started_at TIMESTAMPTZ,
    phase_duration_sec INTEGER DEFAULT 0,
    paused_remaining_sec INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    allowed_players TEXT[] DEFAULT '{}'::TEXT[]
);

-- 2. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE hearts_game_state;

-- 3. RLS (Row Level Security) - Simplified for the trial
ALTER TABLE public.hearts_game_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all public access for Hearts game" 
ON public.hearts_game_state 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 4. Initial Row
INSERT INTO public.hearts_game_state (id, phase, system_start)
VALUES ('hearts_main', 'idle', FALSE)
ON CONFLICT (id) DO NOTHING;
