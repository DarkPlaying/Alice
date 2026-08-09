-- =========================================================
-- JOKER GAME (THE ULTIMATE PROTOCOL) SUPABASE DATABASE SCHEMA
-- =========================================================

CREATE TABLE IF NOT EXISTS public.joker_game_state (
    id TEXT PRIMARY KEY DEFAULT 'joker_main',
    phase TEXT NOT NULL DEFAULT 'idle', -- 'idle', 'briefing', 'choosing', 'minigame', 'scoring', 'end'
    current_round INTEGER NOT NULL DEFAULT 1,
    phase_started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    phase_duration_sec INTEGER NOT NULL DEFAULT 30,
    is_paused BOOLEAN NOT NULL DEFAULT false,
    system_start BOOLEAN NOT NULL DEFAULT false,
    map_rotation INTEGER NOT NULL DEFAULT 0, -- 0, 90, 180, 270 degrees
    map_matrix JSONB DEFAULT '[]'::jsonb, -- 7x7 grid cells layout
    participants JSONB DEFAULT '[]'::jsonb, -- Player objects array
    allowed_players JSONB DEFAULT '[]'::jsonb, -- Allowed user IDs array
    game_logs JSONB DEFAULT '[]'::jsonb,
    winner_id TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Default single record row for Joker Game
INSERT INTO public.joker_game_state (id, phase, current_round, system_start)
VALUES ('joker_main', 'idle', 1, false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.joker_game_state ENABLE ROW LEVEL SECURITY;

-- Anonymous/Public Read & Update Policies for Realtime Game Sync
CREATE POLICY "Allow public read access on joker_game_state"
    ON public.joker_game_state FOR SELECT USING (true);

CREATE POLICY "Allow public insert/update access on joker_game_state"
    ON public.joker_game_state FOR ALL USING (true);

-- Enable Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.joker_game_state;
