-- Temporary fix: Manually add player score to test the display
-- This will verify the Player view can read scores correctly

-- First, let's see the current state
SELECT 
    id,
    scores->'current' as current_scores,
    scores->'start' as start_scores,
    allowed_players
FROM clubs_game_status
WHERE id = 'clubs_king';

-- Add player score manually
-- Replace 'PLAYER_UID_HERE' with the actual player's Firebase UID from allowed_players
UPDATE clubs_game_status
SET scores = jsonb_set(
    COALESCE(scores, '{}'::jsonb),
    '{current,PLAYER_UID_HERE}',
    '1000'::jsonb
)
WHERE id = 'clubs_king';

-- Verify
SELECT scores FROM clubs_game_status WHERE id = 'clubs_king';
