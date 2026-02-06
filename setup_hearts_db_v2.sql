-- Recreate Hearts Game Table with Correct Schema for Admin Integration
DROP TABLE IF EXISTS public.hearts_game_state;

CREATE TABLE public.hearts_game_state (
    id TEXT PRIMARY KEY DEFAULT 'hearts_10', -- Fixed ID to match Admin Dashboard
    phase TEXT DEFAULT 'idle',               -- Renamed from game_state to match Admin
    is_paused BOOLEAN DEFAULT FALSE,
    system_start BOOLEAN DEFAULT FALSE,      -- Trigger for game start
    current_round INTEGER DEFAULT 0,
    phase_expiry TIMESTAMP WITH TIME ZONE,
    participants JSONB DEFAULT '[]'::jsonb,  -- List of player IDs
    players JSONB DEFAULT '{}'::jsonb,       -- Detailed player state (Master managed)
    pairs JSONB DEFAULT '[]'::jsonb,
    player_guesses JSONB DEFAULT '{}'::jsonb,
    assigned_suits JSONB DEFAULT '{}'::jsonb,
    chat_counts JSONB DEFAULT '{}'::jsonb,
    eliminated JSONB DEFAULT '[]'::jsonb,
    winners JSONB DEFAULT '[]'::jsonb,
    round_data JSONB DEFAULT '{}'::jsonb,    -- Backup/Extra data
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert Default Row
INSERT INTO public.hearts_game_state (id, phase)
VALUES ('hearts_10', 'idle');

-- Enable RLS (Development Policy)
ALTER TABLE public.hearts_game_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow All Access"
ON public.hearts_game_state
FOR ALL
USING (true)
WITH CHECK (true);
