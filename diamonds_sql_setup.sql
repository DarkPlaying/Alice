-- DIAMONDS GAME TABLES

-- 1. Diamond Game Game State
CREATE TABLE IF NOT EXISTS public.diamonds_game_state (
    id TEXT PRIMARY KEY, -- 'diamonds_king'
    phase TEXT NOT NULL DEFAULT 'idle', -- idle, briefing, shuffle, dealing, slotting, evaluation, picking, scoring, end
    current_round INTEGER DEFAULT 1,
    active_game_id TEXT, -- ID for history tracking
    participants JSONB DEFAULT '[]'::jsonb, -- Array of player objects {id, name, score, status, role}
    round_data JSONB DEFAULT '{}'::jsonb, -- Store round specific data like pairs, battle results etc.
    phase_started_at TIMESTAMP WITH TIME ZONE,
    phase_duration_sec INTEGER DEFAULT 0,
    is_paused BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Diamond Player Hands
CREATE TABLE IF NOT EXISTS public.diamonds_hands (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id TEXT NOT NULL, -- 'diamonds_king' or session ID
    player_id TEXT NOT NULL,
    cards JSONB DEFAULT '[]'::jsonb, -- Array of {id, type, value, rank, suit}
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, player_id)
);

-- 3. Diamond Player Slots (The 5 cards they chose to battle)
CREATE TABLE IF NOT EXISTS public.diamonds_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    slots JSONB DEFAULT '[]'::jsonb, -- Array of 5 cards (can be null/empty placeholders if not filled)
    locked BOOLEAN DEFAULT FALSE, -- Once confirmed, they are locked
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, player_id, round)
);

-- RLS POLICIES

ALTER TABLE public.diamonds_game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diamonds_hands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diamonds_slots ENABLE ROW LEVEL SECURITY;

-- Game State: Public Read, Service Role Write (or admin)
CREATE POLICY "Public Read Game State" ON public.diamonds_game_state FOR SELECT USING (true);
CREATE POLICY "Admin Update Game State" ON public.diamonds_game_state FOR UPDATE USING (true); -- Simplified for dev
CREATE POLICY "Admin Insert Game State" ON public.diamonds_game_state FOR INSERT WITH CHECK (true);

-- Hands: Player Read Own, Admin Read All
CREATE POLICY "Read Own Hand" ON public.diamonds_hands FOR SELECT USING (auth.uid()::text = player_id OR true); -- 'OR true' for now to allow Master to see all if needed or logic handling
CREATE POLICY "Update Own Hand" ON public.diamonds_hands FOR UPDATE USING (true); -- Simplified
CREATE POLICY "Insert Hand" ON public.diamonds_hands FOR INSERT WITH CHECK (true);
CREATE POLICY "Delete Hand" ON public.diamonds_hands FOR DELETE USING (true);

-- Slots: Public Read (needed for evaluation/rendering opponent slots later), Player Write Own
CREATE POLICY "Read Slots" ON public.diamonds_slots FOR SELECT USING (true);
CREATE POLICY "Update Own Slots" ON public.diamonds_slots FOR UPDATE USING (auth.uid()::text = player_id OR true);
CREATE POLICY "Insert Own Slots" ON public.diamonds_slots FOR INSERT WITH CHECK (true);

-- Initialize Default State
INSERT INTO public.diamonds_game_state (id, phase)
VALUES ('diamonds_king', 'idle')
ON CONFLICT (id) DO NOTHING;
