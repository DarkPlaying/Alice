-- Grant usage on schema (often needed for anon/authenticated access)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- Ensure Table Exists
CREATE TABLE IF NOT EXISTS public.spades_game_state (
    id TEXT PRIMARY KEY,
    phase TEXT NOT NULL DEFAULT 'idle',
    current_round INTEGER NOT NULL DEFAULT 1,
    is_paused BOOLEAN NOT NULL DEFAULT false,
    system_start BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT false,
    allowed_players TEXT[] DEFAULT '{}',
    players JSONB DEFAULT '{}'::jsonb,
    round_data JSONB DEFAULT '{}'::jsonb,
    deck JSONB DEFAULT '[]'::jsonb,
    phase_expiry TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant Permissions on Table
GRANT ALL ON TABLE public.spades_game_state TO postgres, anon, authenticated, service_role;

-- Reset RLS
ALTER TABLE public.spades_game_state ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow public read spades_game_state" ON public.spades_game_state;
DROP POLICY IF EXISTS "Allow public update spades_game_state" ON public.spades_game_state;
DROP POLICY IF EXISTS "Allow public insert spades_game_state" ON public.spades_game_state;

-- Re-create Policies
CREATE POLICY "Allow public read spades_game_state" ON public.spades_game_state FOR SELECT USING (true);
CREATE POLICY "Allow public update spades_game_state" ON public.spades_game_state FOR UPDATE USING (true);
CREATE POLICY "Allow public insert spades_game_state" ON public.spades_game_state FOR INSERT WITH CHECK (true);

-- Ensure Initial Row Exists
INSERT INTO public.spades_game_state (id, phase, is_active, allowed_players)
VALUES ('spades_main', 'idle', false, '{}')
ON CONFLICT (id) DO NOTHING;

-- Also fix Spades Bids just in case
CREATE TABLE IF NOT EXISTS public.spades_bids (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES public.spades_game_state(id),
    player_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    bid_amount INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON TABLE public.spades_bids TO postgres, anon, authenticated, service_role;
ALTER TABLE public.spades_bids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read spades_bids" ON public.spades_bids;
DROP POLICY IF EXISTS "Allow public insert spades_bids" ON public.spades_bids;
DROP POLICY IF EXISTS "Allow public update spades_bids" ON public.spades_bids;
CREATE POLICY "Allow public read spades_bids" ON public.spades_bids FOR SELECT USING (true);
CREATE POLICY "Allow public insert spades_bids" ON public.spades_bids FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update spades_bids" ON public.spades_bids FOR UPDATE USING (true);
