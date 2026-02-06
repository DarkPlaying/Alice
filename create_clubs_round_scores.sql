-- Create table for tracking round-by-round scores in Clubs game
CREATE TABLE IF NOT EXISTS clubs_round_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id TEXT NOT NULL DEFAULT 'clubs_king',
    player_email TEXT NOT NULL,
    player_uid TEXT,
    round_number INTEGER NOT NULL,
    points_earned INTEGER NOT NULL,
    total_score INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_player_round UNIQUE (game_id, player_email, round_number)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_clubs_round_scores_email ON clubs_round_scores(player_email);
CREATE INDEX IF NOT EXISTS idx_clubs_round_scores_game_round ON clubs_round_scores(game_id, round_number);

-- Enable Row Level Security
ALTER TABLE clubs_round_scores ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read
CREATE POLICY "Allow authenticated users to read round scores"
ON clubs_round_scores FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow all authenticated users to insert
CREATE POLICY "Allow authenticated users to insert round scores"
ON clubs_round_scores FOR INSERT
TO authenticated
WITH CHECK (true);
