-- Create clubs_marks table for tracking each round's results
CREATE TABLE IF NOT EXISTS clubs_marks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    revealed_cards TEXT[] NOT NULL,
    all_votes JSONB DEFAULT '{}'::jsonb,
    player_round_score INTEGER DEFAULT 0,
    master_round_score INTEGER DEFAULT 0,
    player_total_score INTEGER DEFAULT 0,
    master_total_score INTEGER DEFAULT 0,
    vote_count INTEGER DEFAULT 0,
    has_penalty BOOLEAN DEFAULT false,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_clubs_marks_game_id ON clubs_marks(game_id);
CREATE INDEX IF NOT EXISTS idx_clubs_marks_round ON clubs_marks(game_id, round_number);
CREATE INDEX IF NOT EXISTS idx_clubs_marks_timestamp ON clubs_marks(timestamp DESC);

-- Add RLS (Row Level Security) policies
ALTER TABLE clubs_marks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all marks
CREATE POLICY "Allow authenticated read access" ON clubs_marks
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert marks (for game recording)
CREATE POLICY "Allow authenticated insert access" ON clubs_marks
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Service role full access" ON clubs_marks
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Optional: Grant permissions to anon users (if needed for game play)
GRANT SELECT ON clubs_marks TO anon;
GRANT INSERT ON clubs_marks TO authenticated;

COMMENT ON TABLE clubs_marks IS 'Stores round-by-round results for Clubs game';
COMMENT ON COLUMN clubs_marks.revealed_cards IS 'Array of card IDs that were revealed this round';
COMMENT ON COLUMN clubs_marks.all_votes IS 'JSON object containing all player votes {userId: cardId}';
COMMENT ON COLUMN clubs_marks.player_round_score IS 'Points scored by players this round';
COMMENT ON COLUMN clubs_marks.master_round_score IS 'Points scored by master this round';
COMMENT ON COLUMN clubs_marks.player_total_score IS 'Cumulative player score up to this round';
COMMENT ON COLUMN clubs_marks.master_total_score IS 'Cumulative master score up to this round';
