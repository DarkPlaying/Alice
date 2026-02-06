-- Add Hearts game entry to clubs_game_status table with allowed_players support
-- This enables allowlist tracking for the Hearts game

-- Insert or update the hearts_king row
INSERT INTO clubs_game_status (
    id,
    system_start,
    is_active,
    is_paused,
    allowed_players
)
VALUES (
    'hearts_king',
    false,
    false,
    false,
    '{}'::text[]  -- Empty text array initially
)
ON CONFLICT (id)
DO UPDATE SET
    allowed_players = COALESCE(clubs_game_status.allowed_players, '{}'::text[]);

-- Verify the column exists and add comment
COMMENT ON COLUMN clubs_game_status.allowed_players IS 'Array of Firebase user IDs allowed to access this game instance';
