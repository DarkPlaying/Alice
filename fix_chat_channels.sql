-- FIX CHAT CHANNELS
-- This script updates the 'channel' column for existing messages based on the user_name.
-- It ensures that historical messages from 'MASTER' are correctly tagged as 'master' channel.

-- 1. Update Master messages
UPDATE public.messages
SET channel = 'master'
WHERE user_name = 'MASTER' OR user_name = 'Gamemaster' OR user_name LIKE '%Admin%';

-- 2. Update System messages (Optional: Assign to 'player' or keep as is? Usually System is for everyone)
-- For now, let's assume System messages about the game flow are relevant to players.
UPDATE public.messages
SET channel = 'player'
WHERE user_name = 'SYSTEM' AND channel IS NULL;

-- 3. Ensure all other nulls are 'player'
UPDATE public.messages
SET channel = 'player'
WHERE channel IS NULL;

-- 4. Verify RLS (Just to be safe)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All Access" ON public.messages;
CREATE POLICY "Allow All Access" ON public.messages FOR ALL USING (true) WITH CHECK (true);
