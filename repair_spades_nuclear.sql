-- NUCLEAR SPADES REPAIR SCRIPT
-- Run this in Supabase SQL Editor to force-fix Realtime, Permissions, and Schema.

-- 1. Force Clean up RLS and Grant Permissions
ALTER TABLE public.spades_game_state DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.spades_bids DISABLE ROW LEVEL SECURITY;

GRANT ALL ON public.spades_game_state TO anon, authenticated, service_role;
GRANT ALL ON public.spades_bids TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Ensure Correct Data Structure
ALTER TABLE public.spades_game_state ADD COLUMN IF NOT EXISTS system_start BOOLEAN DEFAULT false;
ALTER TABLE public.spades_game_state ADD COLUMN IF NOT EXISTS allowed_players TEXT[] DEFAULT '{}';
ALTER TABLE public.spades_game_state ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'idle';
ALTER TABLE public.spades_game_state ADD COLUMN IF NOT EXISTS current_round INTEGER DEFAULT 0;

-- 3. Fix Realtime Publication (Nuclear version)
-- First, try to remove from publication safely
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.spades_game_state;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.spades_bids;

-- Re-add with explicit schema
ALTER PUBLICATION supabase_realtime ADD TABLE public.spades_game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.spades_bids;

-- 4. Set Replica Identity (Required for UPDATE events in Realtime)
ALTER TABLE public.spades_game_state REPLICA IDENTITY FULL;
ALTER TABLE public.spades_bids REPLICA IDENTITY FULL;

-- 5. Force Re-enable RLS with Permissive Policies
ALTER TABLE public.spades_game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spades_bids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permit_all_spades_state" ON public.spades_game_state;
CREATE POLICY "permit_all_spades_state" ON public.spades_game_state FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "permit_all_spades_bids" ON public.spades_bids;
CREATE POLICY "permit_all_spades_bids" ON public.spades_bids FOR ALL USING (true) WITH CHECK (true);

-- 6. Ensure Initial Row is Active
INSERT INTO public.spades_game_state (id, system_start, phase, current_round) 
VALUES ('spades_main', false, 'idle', 0)
ON CONFLICT (id) DO UPDATE SET updated_at = now();

SELECT 'SPADES REPAIR COMPLETE' as status;
