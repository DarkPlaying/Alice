-- Simulate Admin clicking "INITIATE PROTOCOL" button
-- This adds current logged-in users as participants
-- Run this in Supabase SQL Editor

-- Get your actual Firebase UID by checking browser console: auth.currentUser.uid
-- Replace 'YOUR_MASTER_UID' and 'YOUR_PLAYER_UID' with real UIDs

UPDATE hearts_game_state
SET 
    participants = ARRAY['YOUR_MASTER_UID', 'YOUR_PLAYER_UID'],  -- REPLACE WITH REAL UIDs!
    system_start = true,
    phase = 'idle',  -- Keep idle, auto-start will trigger
    is_paused = false
WHERE id = 'hearts_10';

-- Verify
SELECT phase, participants, system_start FROM hearts_game_state WHERE id = 'hearts_10';

-- After running this, refresh your Hearts page - should auto-start to briefing!
