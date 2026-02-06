-- Migration: Add timestamp-based timing to Spades Game
-- This migration updates the spades_game_state table to use timestamp-based timers
-- instead of simple expiry timestamps, enabling proper pause/resume functionality.

-- Add timestamp-based timing columns
ALTER TABLE public.spades_game_state 
  ADD COLUMN IF NOT EXISTS phase_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phase_duration_sec INTEGER,
  ADD COLUMN IF NOT EXISTS paused_remaining_sec INTEGER;

-- Drop old phase_expiry column if it exists
ALTER TABLE public.spades_game_state 
  DROP COLUMN IF EXISTS phase_expiry;

-- Ensure allowed_players exists for whitelist
ALTER TABLE public.spades_game_state 
  ADD COLUMN IF NOT EXISTS allowed_players TEXT[] DEFAULT '{}';

-- Update phase column to enforce valid phase values
ALTER TABLE public.spades_game_state
  DROP CONSTRAINT IF EXISTS valid_phase;

ALTER TABLE public.spades_game_state
  ADD CONSTRAINT valid_phase CHECK (phase IN ('idle', 'briefing', 'hint', 'bidding', 'reveal', 'completed'));

-- Add indexes for performance on bids table
CREATE INDEX IF NOT EXISTS idx_spades_bids_lookup 
  ON public.spades_bids (game_id, round, player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_spades_bids_round 
  ON public.spades_bids (game_id, round);

-- Enable Realtime on both tables (idempotent operation)
-- Note: This requires the tables to already exist from the initial migration

-- Ensure RLS is properly configured
ALTER TABLE public.spades_game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spades_bids ENABLE ROW LEVEL SECURITY;

-- Update policies to be more permissive for development
-- In production, these should be tightened based on auth roles

DROP POLICY IF EXISTS "Allow public read spades_game_state" ON public.spades_game_state;
DROP POLICY IF EXISTS "Allow public update spades_game_state" ON public.spades_game_state;
DROP POLICY IF EXISTS "Allow public insert spades_game_state" ON public.spades_game_state;

CREATE POLICY "Allow public read spades_game_state" 
  ON public.spades_game_state FOR SELECT USING (true);

CREATE POLICY "Allow public update spades_game_state" 
  ON public.spades_game_state FOR UPDATE USING (true);

CREATE POLICY "Allow public insert spades_game_state" 
  ON public.spades_game_state FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read spades_bids" ON public.spades_bids;
DROP POLICY IF EXISTS "Allow public insert spades_bids" ON public.spades_bids;
DROP POLICY IF EXISTS "Allow public update spades_bids" ON public.spades_bids;

CREATE POLICY "Allow public read spades_bids" 
  ON public.spades_bids FOR SELECT USING (true);

CREATE POLICY "Allow public insert spades_bids" 
  ON public.spades_bids FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update spades_bids" 
  ON public.spades_bids FOR UPDATE USING (true);

-- Add helpful comments
COMMENT ON COLUMN public.spades_game_state.phase_started_at IS 'UTC timestamp when the current phase began. Used with phase_duration_sec to compute remaining time on clients.';
COMMENT ON COLUMN public.spades_game_state.phase_duration_sec IS 'Duration in seconds for the current phase. Clients compute remaining = duration - (now - started_at).';
COMMENT ON COLUMN public.spades_game_state.paused_remaining_sec IS 'When paused, stores the remaining seconds. On resume, this becomes the new phase_duration_sec.';
COMMENT ON COLUMN public.spades_game_state.allowed_players IS 'Array of user IDs whitelisted to join this game session. Set by Admin Dashboard.';
