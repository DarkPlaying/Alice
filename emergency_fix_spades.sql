-- EMERGENCY FIX FOR 406 ERRORS
-- This globally disables Row Level Security for Spades tables.
-- Run this to immediately unblock the game.

-- 1. Disable RLS (Nuclear Option for Debugging)
ALTER TABLE public.spades_game_state DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.spades_bids DISABLE ROW LEVEL SECURITY;

-- 2. Explicitly Grant All Permissions
GRANT ALL ON TABLE public.spades_game_state TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.spades_bids TO anon, authenticated, service_role;

-- 3. Ensure ID exists
INSERT INTO public.spades_game_state (id, phase, is_active, allowed_players, system_start)
VALUES ('spades_main', 'idle', false, '{}', false)
ON CONFLICT (id) DO UPDATE SET
    is_active = COALESCE(spades_game_state.is_active, false);

-- 4. Verify Schema (Add columns if missing)
ALTER TABLE public.spades_game_state ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;
ALTER TABLE public.spades_game_state ADD COLUMN IF NOT EXISTS allowed_players TEXT[] DEFAULT '{}';
