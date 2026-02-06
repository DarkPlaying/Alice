-- CRITICAL: Add missing game_state column to clubs_game_status
-- This is why evaluation is failing!

-- First, let's see ALL current columns
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'clubs_game_status'
ORDER BY ordinal_position;

-- Add game_state column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clubs_game_status' AND column_name = 'game_state'
    ) THEN
        -- Add the column
        ALTER TABLE clubs_game_status ADD COLUMN game_state TEXT DEFAULT 'idle';
        RAISE NOTICE 'Added game_state column';
        
        -- If there's existing data, set it to a reasonable default
        UPDATE clubs_game_status SET game_state = 'setup_phase1' WHERE game_state IS NULL;
    ELSE
        RAISE NOTICE 'game_state column already exists';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'clubs_game_status' AND column_name = 'game_state';

-- Show current row to verify
SELECT id, game_state, current_round, player_score, master_score 
FROM clubs_game_status 
WHERE id = 'clubs_king';
