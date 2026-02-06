-- FORCE SCHEMA UPDATE
-- This script explicitly adds missing columns if the table already exists but is outdated.

-- 1. Ensure 'clubs_game_status' exists and has all columns
CREATE TABLE IF NOT EXISTS public.clubs_game_status (
    id TEXT PRIMARY KEY DEFAULT 'clubs_king'
);

-- Add columns individually to ensure they exist even if the table was created previously
ALTER TABLE public.clubs_game_status ADD COLUMN IF NOT EXISTS current_round INTEGER DEFAULT 0;
ALTER TABLE public.clubs_game_status ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;
ALTER TABLE public.clubs_game_status ADD COLUMN IF NOT EXISTS is_finished BOOLEAN DEFAULT false;
ALTER TABLE public.clubs_game_status ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT false;
ALTER TABLE public.clubs_game_status ADD COLUMN IF NOT EXISTS system_start BOOLEAN DEFAULT false;
ALTER TABLE public.clubs_game_status ADD COLUMN IF NOT EXISTS total_players INTEGER DEFAULT 0;
ALTER TABLE public.clubs_game_status ADD COLUMN IF NOT EXISTS votes_submitted INTEGER DEFAULT 0;
ALTER TABLE public.clubs_game_status ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.clubs_game_status ADD COLUMN IF NOT EXISTS gameState TEXT DEFAULT 'idle';

-- Ensure the tracking row exists
INSERT INTO public.clubs_game_status (id)
VALUES ('clubs_king')
ON CONFLICT (id) DO NOTHING;

-- 2. Live Vote Tracker
CREATE TABLE IF NOT EXISTS public.clubs_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_number INTEGER NOT NULL,
    card_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(round_number, user_id)
);

-- 3. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add message columns
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'player';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

-- Enable Realtime
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE tablename = 'clubs_game_status') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE clubs_game_status;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE tablename = 'clubs_votes') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE clubs_votes;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE tablename = 'messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
END $$;

-- Enable RLS & Policies (Drop existing to avoid conflicts)
ALTER TABLE public.clubs_game_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All Access" ON public.clubs_game_status;
CREATE POLICY "Allow All Access" ON public.clubs_game_status FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow All Access" ON public.clubs_votes;
CREATE POLICY "Allow All Access" ON public.clubs_votes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow All Access" ON public.messages;
CREATE POLICY "Allow All Access" ON public.messages FOR ALL USING (true) WITH CHECK (true);

-- Functions & Triggers
CREATE OR REPLACE FUNCTION public.handle_clubs_vote_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.clubs_game_status 
        SET votes_submitted = votes_submitted + 1,
            last_updated = now()
        WHERE id = 'clubs_king';
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.clubs_game_status 
        SET votes_submitted = GREATEST(0, votes_submitted - 1),
            last_updated = now()
        WHERE id = 'clubs_king';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_clubs_vote_change ON public.clubs_votes;
CREATE TRIGGER on_clubs_vote_change
AFTER INSERT OR DELETE ON public.clubs_votes
FOR EACH ROW EXECUTE FUNCTION public.handle_clubs_vote_count();

CREATE OR REPLACE FUNCTION public.reset_clubs_round(p_round INT)
RETURNS void AS $$
BEGIN
    DELETE FROM public.clubs_votes WHERE round_number = p_round;
    UPDATE public.clubs_game_status 
    SET votes_submitted = 0, 
        current_round = p_round,
        last_updated = now()
    WHERE id = 'clubs_king';
END;
$$ LANGUAGE plpgsql;
