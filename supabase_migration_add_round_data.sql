-- Fix missing columns in clubs_game_status table
-- This adds round_data and gameState columns needed by Admin Dashboard
-- Run this in Supabase SQL Editor

-- Add round_data column for storing round-specific game state
ALTER TABLE clubs_game_status 
ADD COLUMN IF NOT EXISTS round_data JSONB DEFAULT '{}'::jsonb;

-- Add gameState column for tracking overall game state
ALTER TABLE clubs_game_status 
ADD COLUMN IF NOT EXISTS gameState TEXT DEFAULT 'idle';

-- Add helpful comments
COMMENT ON COLUMN clubs_game_status.round_data IS 'Stores round-specific data including force_reset timestamps and other game state information';
COMMENT ON COLUMN clubs_game_status.gameState IS 'Overall game state: idle, waiting, playing, evaluation, etc.';

-- Create index for better query performance on round_data
CREATE INDEX IF NOT EXISTS idx_clubs_game_round_data ON clubs_game_status USING GIN (round_data);

-- Verify the changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'clubs_game_status' 
AND column_name IN ('round_data', 'gameState')
ORDER BY column_name;
