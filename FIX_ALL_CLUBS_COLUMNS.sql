-- COMPREHENSIVE SQL MIGRATION FOR CLUBS GAME
-- Run this ONCE in Supabase SQL Editor to add all missing columns
-- This will fix ALL database schema issues

-- 1. Add gameState column (TEXT)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clubs_game_status' AND column_name = 'gameState'
    ) THEN
        ALTER TABLE clubs_game_status ADD COLUMN "gameState" TEXT DEFAULT 'idle';
        RAISE NOTICE '✓ Added gameState column';
    ELSE
        RAISE NOTICE '  gameState column already exists';
    END IF;
END $$;

-- 2. Add round_data column (JSONB)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clubs_game_status' AND column_name = 'round_data'
    ) THEN
        ALTER TABLE clubs_game_status ADD COLUMN round_data JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE '✓ Added round_data column';
    ELSE
        RAISE NOTICE '  round_data column already exists';
    END IF;
END $$;

-- 3. Add player_score column (INTEGER)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clubs_game_status' AND column_name = 'player_score'
    ) THEN
        ALTER TABLE clubs_game_status ADD COLUMN player_score INTEGER DEFAULT 0;
        RAISE NOTICE '✓ Added player_score column';
    ELSE
        RAISE NOTICE '  player_score column already exists';
    END IF;
END $$;

-- 4. Add master_score column (INTEGER)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clubs_game_status' AND column_name = 'master_score'
    ) THEN
        ALTER TABLE clubs_game_status ADD COLUMN master_score INTEGER DEFAULT 0;
        RAISE NOTICE '✓ Added master_score column';
    ELSE
        RAISE NOTICE '  master_score column already exists';
    END IF;
END $$;

-- 5. Add removed_cards_p column (TEXT ARRAY)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clubs_game_status' AND column_name = 'removed_cards_p'
    ) THEN
        ALTER TABLE clubs_game_status ADD COLUMN removed_cards_p TEXT[] DEFAULT '{}';
        RAISE NOTICE '✓ Added removed_cards_p column';
    ELSE
        RAISE NOTICE '  removed_cards_p column already exists';
    END IF;
END $$;

-- 6. Add removed_cards_m column (TEXT ARRAY)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clubs_game_status' AND column_name = 'removed_cards_m'
    ) THEN
        ALTER TABLE clubs_game_status ADD COLUMN removed_cards_m TEXT[] DEFAULT '{}';
        RAISE NOTICE '✓ Added removed_cards_m column';
    ELSE
        RAISE NOTICE '  removed_cards_m column already exists';
    END IF;
END $$;

-- 7. Add phase_expiry column (TIMESTAMPTZ) - if needed
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clubs_game_status' AND column_name = 'phase_expiry'
    ) THEN
        ALTER TABLE clubs_game_status ADD COLUMN phase_expiry TIMESTAMPTZ;
        RAISE NOTICE '✓ Added phase_expiry column';
    ELSE
        RAISE NOTICE '  phase_expiry column already exists';
    END IF;
END $$;

-- VERIFICATION: Show all columns
SELECT 
    column_name, 
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'clubs_game_status'
ORDER BY ordinal_position;

-- Initialize row if it doesn't exist
INSERT INTO clubs_game_status (id, "gameState", current_round, player_score, master_score, round_data, removed_cards_p, removed_cards_m)
VALUES ('clubs_king', 'idle', 0, 0, 0, '{}'::jsonb, '{}', '{}')
ON CONFLICT (id) DO NOTHING;

-- Show final state
SELECT * FROM clubs_game_status WHERE id = 'clubs_king';
