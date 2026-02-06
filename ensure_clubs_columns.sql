-- Ensure all required columns exist for Clubs game
-- Run this in Supabase SQL Editor

-- Add player_score column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clubs_game_status' AND column_name = 'player_score'
    ) THEN
        ALTER TABLE clubs_game_status ADD COLUMN player_score INTEGER DEFAULT 0;
        RAISE NOTICE 'Added player_score column';
    ELSE
        RAISE NOTICE 'player_score column already exists';
    END IF;
END $$;

-- Add master_score column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clubs_game_status' AND column_name = 'master_score'
    ) THEN
        ALTER TABLE clubs_game_status ADD COLUMN master_score INTEGER DEFAULT 0;
        RAISE NOTICE 'Added master_score column';
    ELSE
        RAISE NOTICE 'master_score column already exists';
    END IF;
END $$;

-- Add removed_cards_p column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clubs_game_status' AND column_name = 'removed_cards_p'
    ) THEN
        ALTER TABLE clubs_game_status ADD COLUMN removed_cards_p TEXT[] DEFAULT '{}';
        RAISE NOTICE 'Added removed_cards_p column';
    ELSE
        RAISE NOTICE 'removed_cards_p column already exists';
    END IF;
END $$;

-- Add removed_cards_m column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clubs_game_status' AND column_name = 'removed_cards_m'
    ) THEN
        ALTER TABLE clubs_game_status ADD COLUMN removed_cards_m TEXT[] DEFAULT '{}';
        RAISE NOTICE 'Added removed_cards_m column';
    ELSE
        RAISE NOTICE 'removed_cards_m column already exists';
    END IF;
END $$;

-- Verify all columns exist
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'clubs_game_status' 
    AND column_name IN ('player_score', 'master_score', 'removed_cards_p', 'removed_cards_m')
ORDER BY column_name;
