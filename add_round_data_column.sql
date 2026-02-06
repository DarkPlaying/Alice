-- Add missing round_data column to clubs_game_status
-- This JSONB column stores dynamic game state like selections and phase data

-- Add round_data column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clubs_game_status' AND column_name = 'round_data'
    ) THEN
        ALTER TABLE clubs_game_status ADD COLUMN round_data JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Added round_data column';
    ELSE
        RAISE NOTICE 'round_data column already exists';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'clubs_game_status' AND column_name = 'round_data';

-- Show current status
SELECT id, gameState, current_round, round_data
FROM clubs_game_status 
WHERE id = 'clubs_king';
