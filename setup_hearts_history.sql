-- =====================================================
-- Hearts Game History System - Database Schema
-- =====================================================

-- 1. Create Hearts game sessions table
CREATE TABLE IF NOT EXISTS hearts_game_sessions (
  id TEXT PRIMARY KEY,                    -- Unique ID (e.g., "HRTS-1A2B3C")
  status TEXT DEFAULT 'active',           -- 'active', 'saved', 'deleted'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  saved_at TIMESTAMPTZ,
  current_round INTEGER DEFAULT 0,
  total_rounds INTEGER DEFAULT 5,         -- Hearts usually has 5 rounds
  metadata JSONB                          -- Additional settings
);

-- 2. Create Hearts round points tracking table
CREATE TABLE IF NOT EXISTS hearts_round_points (
  id SERIAL PRIMARY KEY,
  game_id TEXT REFERENCES hearts_game_sessions(id) ON DELETE CASCADE,
  player_email TEXT NOT NULL,
  round_1 INTEGER DEFAULT 0,
  round_2 INTEGER DEFAULT 0,
  round_3 INTEGER DEFAULT 0,
  round_4 INTEGER DEFAULT 0,
  round_5 INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, player_email)
);

-- Add trigger to update total_points (Optional, can be done in JS too)
-- For now, we'll calculate/update it manually in the code for flexibility.

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_hearts_round_points_game ON hearts_round_points(game_id);
CREATE INDEX IF NOT EXISTS idx_hearts_round_points_email ON hearts_round_points(player_email);
CREATE INDEX IF NOT EXISTS idx_hearts_game_sessions_status ON hearts_game_sessions(status);

-- 4. Add active_game_id to hearts_game_state (Repurposing the main state row)
-- This allows us to map the global 'hearts_main' to a specific session.
ALTER TABLE hearts_game_state 
ADD COLUMN IF NOT EXISTS active_game_id TEXT REFERENCES hearts_game_sessions(id);

-- Enable RLS
ALTER TABLE hearts_game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hearts_round_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow All Access Hearts Sessions" ON hearts_game_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All Access Hearts Points" ON hearts_round_points FOR ALL USING (true) WITH CHECK (true);
