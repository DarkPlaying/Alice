-- Quick fix: Just insert the missing row
-- Run this in Supabase SQL Editor

INSERT INTO hearts_game_state (id, phase, current_round) 
VALUES ('hearts_10', 'idle', 0)
ON CONFLICT (id) DO NOTHING;

-- Verify it worked
SELECT * FROM hearts_game_state WHERE id = 'hearts_10';
