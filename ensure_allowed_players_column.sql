-- Ensure allowed_players column exists in clubs_game_status
ALTER TABLE clubs_game_status 
ADD COLUMN IF NOT EXISTS allowed_players TEXT[] DEFAULT '{}';

-- Ensure it exists in hearts table too if utilizing same logic
-- (Assuming table name based on context, possibly 'hearts_game_status' or similar if it exists, 
-- but GameContainer refers to 'clubs_game_status' for both? No, line 62: GameContainer uses clubs_game_status for id='clubs_king' and id='hearts_10'?)
-- Wait, GameContainer line 63: supabase.from('clubs_game_status').select('*').eq('id', gameId)
-- YES both use 'clubs_game_status' table. 
