-- Create Spades Game State Table
CREATE TABLE IF NOT EXISTS public.spades_game_state (
    id TEXT PRIMARY KEY,
    phase TEXT NOT NULL DEFAULT 'idle',
    current_round INTEGER NOT NULL DEFAULT 1,
    is_paused BOOLEAN NOT NULL DEFAULT false,
    system_start BOOLEAN NOT NULL DEFAULT false,
    players JSONB DEFAULT '{}'::jsonb, -- Map of userId -> { score, cards: [], bid, status }
    round_data JSONB DEFAULT '{}'::jsonb, -- Current round info: target_card, hint, winner, ties
    deck JSONB DEFAULT '[]'::jsonb, -- Available cards
    phase_expiry TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.spades_game_state ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read (for now, tighten later if needed)
CREATE POLICY "Allow public read spades_game_state" ON public.spades_game_state FOR SELECT USING (true);
-- Allow everyone to update (Master needs write, Players might need write for signals if not using separate table)
-- Actually, let's keep it open for ease of development, similar to other games here.
CREATE POLICY "Allow public update spades_game_state" ON public.spades_game_state FOR UPDATE USING (true);
CREATE POLICY "Allow public insert spades_game_state" ON public.spades_game_state FOR INSERT WITH CHECK (true);

-- Create Spades Bids Table (for handling high-frequency inputs if needed, or just history)
CREATE TABLE IF NOT EXISTS public.spades_bids (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES public.spades_game_state(id),
    player_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    bid_amount INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Bids
ALTER TABLE public.spades_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read spades_bids" ON public.spades_bids FOR SELECT USING (true);
CREATE POLICY "Allow public insert spades_bids" ON public.spades_bids FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update spades_bids" ON public.spades_bids FOR UPDATE USING (true);

-- Initial Row
INSERT INTO public.spades_game_state (id, phase, is_paused)
VALUES ('spades_main', 'idle', false)
ON CONFLICT (id) DO NOTHING;
