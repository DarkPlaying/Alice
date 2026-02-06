-- FIX DIAMONDS SCHEMA
-- Run this in Supabase SQL Editor to add required columns for Admin/Player synchronization.

DO $$ 
BEGIN
    -- 1. Add system_start column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'diamonds_game_state' AND column_name = 'system_start'
    ) THEN
        ALTER TABLE public.diamonds_game_state ADD COLUMN system_start BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✓ Added system_start column';
    END IF;

    -- 2. Add is_active column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'diamonds_game_state' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.diamonds_game_state ADD COLUMN is_active BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✓ Added is_active column';
    END IF;

    -- 3. Add gameState column (for consistency with Clubs logic)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'diamonds_game_state' AND column_name = 'gameState'
    ) THEN
        ALTER TABLE public.diamonds_game_state ADD COLUMN "gameState" TEXT DEFAULT 'idle';
        RAISE NOTICE '✓ Added gameState column';
    END IF;

    -- 4. Add allowed_players column (TEXT ARRAY)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'diamonds_game_state' AND column_name = 'allowed_players'
    ) THEN
        ALTER TABLE public.diamonds_game_state ADD COLUMN allowed_players TEXT[] DEFAULT '{}';
        RAISE NOTICE '✓ Added allowed_players column';
    END IF;
END $$;

-- Verify columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'diamonds_game_state';
