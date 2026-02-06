-- Force start Hearts game for testing
-- Run this in Supabase SQL Editor

-- Update game state to force start with 2 test players
UPDATE hearts_game_state
SET 
    phase = 'phase1',
    current_round = 1,
    participants = ARRAY['player1', 'player2'],
    pairs = '{"player1": "player2", "player2": "player1"}'::jsonb,
    assigned_suits = '{"player1": "Hearts", "player2": "Clubs"}'::jsonb,
    system_start = true,
    is_paused = false,
    phase_end_time = EXTRACT(EPOCH FROM NOW())::bigint * 1000 + 60000,  -- 1 minute from now
    chat_counts = '{}'::jsonb,
    player_guesses = '{}'::jsonb,
    eliminated = ARRAY[]::text[],
    winners = ARRAY[]::text[]
WHERE id = 'hearts_10';

-- Verify the update
SELECT phase, current_round, participants, system_start FROM hearts_game_state WHERE id = 'hearts_10';
