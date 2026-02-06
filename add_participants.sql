-- Add test participants to trigger auto-start
-- Run this in Supabase SQL Editor

UPDATE hearts_game_state
SET 
    participants = ARRAY['test_player1', 'test_player2'],
    system_start = true
WHERE id = 'hearts_10';

-- Verify
SELECT id, phase, participants, system_start FROM hearts_game_state WHERE id = 'hearts_10';
