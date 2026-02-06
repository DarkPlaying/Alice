-- Allow 'sanjay' to update the game state (Host Permissions)
-- This allows the client-side Headless Master to write to the DB even if role is 'player'

CREATE POLICY "Allow Sanjay Host Access"
ON public.spades_game_state
FOR UPDATE
TO authenticated
USING (
  (auth.jwt() ->> 'email') = 'sanjay@borderland.com'
  OR
  (auth.jwt() ->> 'email') = 'sanjaym6309@gmail.com'
  OR 
  (auth.jwt() ->> 'email') ilike '%sanjay%'
)
WITH CHECK (
  (auth.jwt() ->> 'email') = 'sanjay@borderland.com'
  OR
  (auth.jwt() ->> 'email') = 'sanjaym6309@gmail.com'
  OR 
  (auth.jwt() ->> 'email') ilike '%sanjay%'
);

-- Ensure the policy is applied (if multiple policies exist, Supabase/Postgres uses OR logic)
-- We don't need to drop existing policies, simply adding this permissive one is enough.
