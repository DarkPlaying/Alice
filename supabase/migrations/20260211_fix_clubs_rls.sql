-- Enable RLS on clubs_game_sessions
ALTER TABLE public.clubs_game_sessions ENABLE ROW LEVEL SECURITY;

-- Policy for clubs_game_sessions (Public access to preserve game logic without auth changes)
CREATE POLICY "Enable all access for public" ON public.clubs_game_sessions
    FOR ALL TO public
    USING (true)
    WITH CHECK (true);


-- Enable RLS on clubs_game_status
ALTER TABLE public.clubs_game_status ENABLE ROW LEVEL SECURITY;

-- Policy for clubs_game_status
CREATE POLICY "Enable all access for public" ON public.clubs_game_status
    FOR ALL TO public
    USING (true)
    WITH CHECK (true);


-- Enable RLS on messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policy for messages
CREATE POLICY "Enable all access for public" ON public.messages
    FOR ALL TO public
    USING (true)
    WITH CHECK (true);


-- Note: 'profiles' table is omitted to avoid accidental lockout if RLS is not already configured.
-- If 'profiles' warnings appear, a similar public policy can be applied or proper Auth sync implemented.
