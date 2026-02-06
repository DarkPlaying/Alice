-- CRITICAL: Add gameState column to clubs_game_status
-- This column is required for the game to function

-- Add gameState column
ALTER TABLE clubs_game_status 
ADD COLUMN IF NOT EXISTS "gameState" TEXT DEFAULT 'idle';

-- Set initial value for existing row
UPDATE clubs_game_status 
SET "gameState" = 'setup_phase1' 
WHERE id = 'clubs_king' AND "gameState" = 'idle';

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clubs_game_status' 
  AND column_name = 'gameState';

-- Show current state
SELECT id, "gameState", current_round, player_score, master_score
FROM clubs_game_status 
WHERE id = 'clubs_king';
