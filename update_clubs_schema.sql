-- Ensure clubs_round_points has all 6 rounds
CREATE TABLE IF NOT EXISTS clubs_round_points (
    game_id TEXT NOT NULL,
    player_email TEXT NOT NULL,
    round_1 INTEGER DEFAULT 0,
    round_2 INTEGER DEFAULT 0,
    round_3 INTEGER DEFAULT 0,
    round_4 INTEGER DEFAULT 0,
    round_5 INTEGER DEFAULT 0,
    round_6 INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    PRIMARY KEY (game_id, player_email)
);

-- Add columns if they don't exist (idempotent)
ALTER TABLE clubs_round_points ADD COLUMN IF NOT EXISTS round_1 INTEGER DEFAULT 0;
ALTER TABLE clubs_round_points ADD COLUMN IF NOT EXISTS round_2 INTEGER DEFAULT 0;
ALTER TABLE clubs_round_points ADD COLUMN IF NOT EXISTS round_3 INTEGER DEFAULT 0;
ALTER TABLE clubs_round_points ADD COLUMN IF NOT EXISTS round_4 INTEGER DEFAULT 0;
ALTER TABLE clubs_round_points ADD COLUMN IF NOT EXISTS round_5 INTEGER DEFAULT 0;
ALTER TABLE clubs_round_points ADD COLUMN IF NOT EXISTS round_6 INTEGER DEFAULT 0;

-- Function to update a player's round score
CREATE OR REPLACE FUNCTION update_player_round_score(
    p_game_id TEXT,
    p_email TEXT,
    p_round INTEGER,
    p_score INTEGER
) RETURNS VOID AS $$
DECLARE
    current_total INTEGER;
    r_col TEXT;
BEGIN
    -- Determine dynamic column name
    r_col := 'round_' || p_round;

    -- Upsert the row (create if not exists)
    INSERT INTO clubs_round_points (game_id, player_email)
    VALUES (p_game_id, p_email)
    ON CONFLICT (game_id, player_email) DO NOTHING;

    -- Update the specific round score dynamically
    EXECUTE 'UPDATE clubs_round_points SET ' || quote_ident(r_col) || ' = $1 WHERE game_id = $2 AND player_email = $3'
    USING p_score, p_game_id, p_email;

    -- Recalculate Total
    UPDATE clubs_round_points
    SET total_points = (
        COALESCE(round_1, 0) + 
        COALESCE(round_2, 0) + 
        COALESCE(round_3, 0) + 
        COALESCE(round_4, 0) + 
        COALESCE(round_5, 0) + 
        COALESCE(round_6, 0)
    )
    WHERE game_id = p_game_id AND player_email = p_email;
END;
$$ LANGUAGE plpgsql;

-- Add removed_cards tracking (view-specific) to Game Status
ALTER TABLE clubs_game_status 
ADD COLUMN IF NOT EXISTS removed_cards_p TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS removed_cards_m TEXT[] DEFAULT '{}';

-- Keep legacy removed_cards for compatibility
ALTER TABLE clubs_game_status 
ADD COLUMN IF NOT EXISTS removed_cards TEXT[] DEFAULT '{}';

-- Add removed_cards to Marks for historical accuracy
ALTER TABLE clubs_marks 
ADD COLUMN IF NOT EXISTS removed_cards TEXT[] DEFAULT '{}';

-- Optional: Add a function to atomically update game state
CREATE OR REPLACE FUNCTION update_clubs_round(
    p_game_id TEXT,
    p_round INTEGER,
    p_removed_cards TEXT[],
    p_player_score INTEGER,
    p_master_score INTEGER
) RETURNS VOID AS $$
BEGIN
    -- Update Status
    UPDATE clubs_game_status
    SET current_round = p_round,
        removed_cards = p_removed_cards, -- Overwrite or Append? Usually we pass the new Full List
        player_score = p_player_score,
        master_score = p_master_score,
        updated_at = NOW()
    WHERE id = p_game_id;
END;
$$ LANGUAGE plpgsql;
