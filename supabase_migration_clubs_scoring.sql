-- 1. Ensure clubs_round_points table exists with correct schema
CREATE TABLE IF NOT EXISTS public.clubs_round_points (
    id SERIAL PRIMARY KEY,
    game_id TEXT NOT NULL,
    player_email TEXT NOT NULL,
    round_1 INTEGER DEFAULT 0,
    round_2 INTEGER DEFAULT 0,
    round_3 INTEGER DEFAULT 0,
    round_4 INTEGER DEFAULT 0,
    round_5 INTEGER DEFAULT 0,
    round_6 INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, player_email)
);

-- 2. Enable RLS but allow open access for game logic (simplify permissions)
ALTER TABLE public.clubs_round_points ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable read access for all users" ON public.clubs_round_points;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.clubs_round_points;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.clubs_round_points;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.clubs_round_points;

-- Create a permissive policy for game interactions
CREATE POLICY "Allow all for authenticated"
ON public.clubs_round_points
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. Fix Master Points: Ensure Master is in Profiles
-- Note: Masters might not always have a profile entry if they are admin-only.
-- This ensures that if a Master participates, they have a profile to store points on.
INSERT INTO public.profiles (email, username, visa_points, wins, losses)
SELECT 
    auth.users.email,
    COALESCE(auth.users.raw_user_meta_data->>'username', 'Master'),
    1000, 
    0, 
    0
FROM auth.users
WHERE auth.users.email ILIKE '%master%' 
AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.email = auth.users.email
);

-- 4. Function to safely update/upsert round points (logic used by Game Master)
CREATE OR REPLACE FUNCTION upsert_round_points(
    p_game_id TEXT,
    p_email TEXT,
    p_round_num INTEGER,
    p_points INTEGER,
    p_total INTEGER
)
RETURNS VOID AS $$
DECLARE
    col_name TEXT;
    query TEXT;
BEGIN
    col_name := 'round_' || p_round_num;
    
    -- Dynamic SQL to handle variable round column
    query := format(
        'INSERT INTO public.clubs_round_points (game_id, player_email, %I, total_points) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (game_id, player_email) 
         DO UPDATE SET %I = $3, total_points = $4, updated_at = NOW();',
        col_name, col_name
    );

    EXECUTE query USING p_game_id, p_email, p_points, p_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC to atomic adjust visa points (Increment/Decrement)
CREATE OR REPLACE FUNCTION adjust_visa_points(p_email TEXT, p_adjustment INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET visa_points = visa_points + p_adjustment,
        updated_at = NOW() -- Assuming updated_at exists, if not remove or add column
    WHERE email = p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fix Profiles RLS (Just in case PlayerCard update is blocked)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated profiles" ON public.profiles;
CREATE POLICY "Allow all for authenticated profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
