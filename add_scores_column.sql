-- Add scores JSONB column to clubs_game_status to track individual scores
ALTER TABLE clubs_game_status 
ADD COLUMN IF NOT EXISTS scores JSONB DEFAULT '{}'::jsonb;
