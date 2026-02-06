-- DROP the table to ensure fresh schema
DROP TABLE IF EXISTS public.hearts_game_state;

-- Create the table for Hearts Game State
CREATE TABLE public.hearts_game_state (
    id TEXT PRIMARY KEY DEFAULT 'hearts_game',
    game_state TEXT DEFAULT 'idle',
    current_round INTEGER DEFAULT 1,
    phase_expiry TIMESTAMP WITH TIME ZONE,
    players JSONB DEFAULT '{}'::jsonb,
    pairs JSONB DEFAULT '[]'::jsonb,
    player_guesses JSONB DEFAULT '{}'::jsonb,
    system_start BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.hearts_game_state ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read/write (Development Policy)
CREATE POLICY "Allow All Access" ON public.hearts_game_state
    FOR ALL USING (true) WITH CHECK (true);

-- Insert initial row
INSERT INTO public.hearts_game_state (id, game_state, current_round, players, pairs)
VALUES ('hearts_game', 'idle', 1, '{}'::jsonb, '[]'::jsonb);
