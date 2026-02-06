-- VERIFY AND GRANT ANON ACCESS FOR SPADES
-- Run this script to confirm if the table is accessible to anonymous users.

-- 1. Explicitly Grant USAGE on Schema
GRANT USAGE ON SCHEMA public TO anon;

-- 2. Explicitly Grant SELECT on Tables to anon
GRANT SELECT, UPDATE, INSERT ON TABLE public.spades_game_state TO anon;
GRANT SELECT, UPDATE, INSERT ON TABLE public.spades_bids TO anon;

-- 3. Ensure RLS is OFF (Double Check)
ALTER TABLE public.spades_game_state DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.spades_bids DISABLE ROW LEVEL SECURITY;

-- 4. TEST QUERY (This will show in the results pane)
SELECT 'Spades Table Status' as check_name, 
       count(*) as row_count, 
       (SELECT count(*) FROM information_schema.role_table_grants WHERE table_name = 'spades_game_state' AND grantee = 'anon') as anon_grants
FROM public.spades_game_state;
