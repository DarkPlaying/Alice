-- Enable RLS on diamonds_game_state
ALTER TABLE public.diamonds_game_state ENABLE ROW LEVEL SECURITY;

-- Policy for diamonds_game_state
CREATE POLICY "Enable all access for public" ON public.diamonds_game_state
    FOR ALL TO public
    USING (true)
    WITH CHECK (true);


-- Enable RLS on diamonds_hands
ALTER TABLE public.diamonds_hands ENABLE ROW LEVEL SECURITY;

-- Policy for diamonds_hands
CREATE POLICY "Enable all access for public" ON public.diamonds_hands
    FOR ALL TO public
    USING (true)
    WITH CHECK (true);


-- Enable RLS on diamonds_slots
ALTER TABLE public.diamonds_slots ENABLE ROW LEVEL SECURITY;

-- Policy for diamonds_slots
CREATE POLICY "Enable all access for public" ON public.diamonds_slots
    FOR ALL TO public
    USING (true)
    WITH CHECK (true);


-- Enable RLS on diamonds_participants
ALTER TABLE public.diamonds_participants ENABLE ROW LEVEL SECURITY;

-- Policy for diamonds_participants
CREATE POLICY "Enable all access for public" ON public.diamonds_participants
    FOR ALL TO public
    USING (true)
    WITH CHECK (true);
