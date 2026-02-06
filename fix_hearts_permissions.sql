-- Fix RLS policies for hearts_game_state
-- Run this in Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read hearts game state" ON hearts_game_state;
DROP POLICY IF EXISTS "Masters can update hearts game state" ON hearts_game_state;

-- Allow EVERYONE (including anon users) to read
CREATE POLICY "Public read access"
    ON hearts_game_state FOR SELECT
    USING (true);

-- Allow EVERYONE (including anon users) to update
CREATE POLICY "Public update access"
    ON hearts_game_state FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Verify it worked - this should return the row
SELECT * FROM hearts_game_state WHERE id = 'hearts_10';
