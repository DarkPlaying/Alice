-- Hearts Full Supabase Migration (Fixed)
-- Creates table for Hearts game state (replacing Firestore)

-- Drop and recreate table if exists
DROP TABLE IF EXISTS hearts_game_state CASCADE;

CREATE TABLE hearts_game_state (
    id TEXT PRIMARY KEY DEFAULT 'hearts_10',
    phase TEXT NOT NULL DEFAULT 'idle',
    current_round INTEGER NOT NULL DEFAULT 0,
    participants TEXT[] DEFAULT '{}',
    pairs JSONB DEFAULT '{}',
    assigned_suits JSONB DEFAULT '{}',
    chat_counts JSONB DEFAULT '{}',
    player_guesses JSONB DEFAULT '{}',
    eliminated TEXT[] DEFAULT '{}',
    winners TEXT[] DEFAULT '{}',
    master_power_usage JSONB DEFAULT '{}',
    system_start BOOLEAN DEFAULT FALSE,
    is_paused BOOLEAN DEFAULT FALSE,
    start_time BIGINT,
    phase_end_time BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default Hearts game state
INSERT INTO hearts_game_state (id) 
VALUES ('hearts_10')
ON CONFLICT (id) DO NOTHING;

-- Enable real-time for the table (only if not already enabled)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'hearts_game_state'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE hearts_game_state;
    END IF;
END $$;

-- Add RLS policies (adjust based on your auth setup)
ALTER TABLE hearts_game_state ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read hearts game state" ON hearts_game_state;
DROP POLICY IF EXISTS "Masters can update hearts game state" ON hearts_game_state;

-- Allow all authenticated users to read
CREATE POLICY "Anyone can read hearts game state"
    ON hearts_game_state FOR SELECT
    TO authenticated
    USING (true);

-- Allow masters to update (you may need to adjust this based on your role system)
CREATE POLICY "Masters can update hearts game state"
    ON hearts_game_state FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
