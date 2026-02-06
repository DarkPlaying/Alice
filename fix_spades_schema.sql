-- Check if timer_display exists and adds it if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'spades_game_state'
        AND column_name = 'timer_display'
    ) THEN
        ALTER TABLE spades_game_state ADD COLUMN timer_display TEXT DEFAULT '00:00';
    END IF;
END $$;

-- Ensure other columns exist just in case
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'spades_game_state'
        AND column_name = 'round_data'
    ) THEN
        ALTER TABLE spades_game_state ADD COLUMN round_data JSONB DEFAULT '{}';
    END IF;
END $$;
