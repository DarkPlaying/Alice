-- Simulate Admin starting Hearts WITH master as a participant
-- This tests master + 1 player pairing
-- Run this in Supabase SQL Editor

UPDATE hearts_game_state
SET 
    phase = 'idle',
    current_round = 0,
    participants = ARRAY['master_user_id', 'player1_user_id'],  -- Master + 1 player
    system_start = true,
    is_paused = false,
    eliminated = ARRAY[]::text[],
    winners = ARRAY[]::text[],
    player_guesses = '{}'::jsonb,
    assigned_suits = '{}'::jsonb,
    chat_counts = '{}'::jsonb,
    pairs = '{}'::jsonb
WHERE id = 'hearts_10';

-- Verify
SELECT phase, array_length(participants, 1) as participant_count, system_start 
FROM hearts_game_state WHERE id = 'hearts_10';

-- Now the game should auto-start and pair master with player!
