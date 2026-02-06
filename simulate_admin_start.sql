-- Simulate Admin "INITIATE PROTOCOL" button for Hearts
-- This mimics what AdminDashboard does when you click the button
-- Run this in Supabase SQL Editor

-- Step 1: Reset game to initial idle state with 4 test participants
UPDATE hearts_game_state
SET 
    phase = 'idle',
    current_round = 0,
    participants = ARRAY['alice_123', 'bob_456', 'carol_789', 'dave_012'],
    system_start = true,
    is_paused = false,
    eliminated = ARRAY[]::text[],
    winners = ARRAY[]::text[],
    player_guesses = '{}'::jsonb,
    assigned_suits = '{}'::jsonb,
    chat_counts = '{}'::jsonb,
    pairs = '{}'::jsonb
WHERE id = 'hearts_10';

-- Verify - should show idle phase with 4 participants and system_start = true
SELECT phase, participants, system_start FROM hearts_game_state WHERE id = 'hearts_10';

-- Now refresh the Hearts Master page - it should auto-start to briefing phase!
