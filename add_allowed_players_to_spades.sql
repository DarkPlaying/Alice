-- Add allowed_players column to spades_game_state if it doesn't exist
ALTER TABLE public.spades_game_state 
ADD COLUMN IF NOT EXISTS allowed_players TEXT[] DEFAULT '{}';

-- Add is_active column to spades_game_state if it doesn't exist (Required by AdminDashboard start logic)
ALTER TABLE public.spades_game_state 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Initial updates to ensure row exists and has defaults
INSERT INTO public.spades_game_state (id, phase, is_paused, system_start, is_active, allowed_players)
VALUES ('spades_main', 'idle', false, false, false, '{}')
ON CONFLICT (id) DO UPDATE SET
    allowed_players = COALESCE(spades_game_state.allowed_players, '{}'),
    is_active = COALESCE(spades_game_state.is_active, false);
