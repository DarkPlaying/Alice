-- =====================================================
-- Clubs Game History System - Database Schema
-- =====================================================

-- 1. Create game sessions table
CREATE TABLE IF NOT EXISTS clubs_game_sessions (
  id TEXT PRIMARY KEY,                    -- Unique 13-char ID (e.g., "CG1A2B3C4D5E6")
  status TEXT DEFAULT 'active',           -- 'active', 'saved', 'deleted'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  saved_at TIMESTAMPTZ,
  current_round INTEGER DEFAULT 0,
  total_rounds INTEGER DEFAULT 5,         -- Clubs has 5 rounds
  metadata JSONB                          -- Additional settings
);

-- 2. Create round points tracking table
CREATE TABLE IF NOT EXISTS clubs_round_points (
  id SERIAL PRIMARY KEY,
  game_id TEXT REFERENCES clubs_game_sessions(id) ON DELETE CASCADE,
  player_email TEXT NOT NULL,
  round_1 INTEGER DEFAULT 0,
  round_2 INTEGER DEFAULT 0,
  round_3 INTEGER DEFAULT 0,
  round_4 INTEGER DEFAULT 0,
  round_5 INTEGER DEFAULT 0,
  total_points INTEGER GENERATED ALWAYS AS (
    round_1 + round_2 + round_3 + round_4 + round_5
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, player_email)
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_round_points_game ON clubs_round_points(game_id);
CREATE INDEX IF NOT EXISTS idx_round_points_email ON clubs_round_points(player_email);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON clubs_game_sessions(status);

-- 4. Add active_game_id to clubs_game_status
ALTER TABLE clubs_game_status 
ADD COLUMN IF NOT EXISTS active_game_id TEXT REFERENCES clubs_game_sessions(id);

-- 5. Create RPC function for safe visa point adjustment
CREATE OR REPLACE FUNCTION adjust_visa_points(
  p_email TEXT,
  p_adjustment INTEGER
) RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET visa_points = visa_points + p_adjustment,
      updated_at = NOW()
  WHERE email = p_email;
  
  -- Log the adjustment
  RAISE NOTICE 'Adjusted visa for %: % points', p_email, p_adjustment;
END;
$$ LANGUAGE plpgsql;

-- 6. Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger for auto-updating timestamps
CREATE TRIGGER update_clubs_round_points_updated_at
  BEFORE UPDATE ON clubs_round_points
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('clubs_game_sessions', 'clubs_round_points');

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('clubs_game_sessions', 'clubs_round_points');

-- Check RPC function
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'adjust_visa_points';
