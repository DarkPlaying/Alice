
-- Create the hearts_guesses table
CREATE TABLE IF NOT EXISTS public.hearts_guesses (
    game_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    player_id TEXT NOT NULL,
    suit TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (game_id, round, player_id)
);

-- Enable RLS
ALTER TABLE public.hearts_guesses ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read/write for now (prototype mode)
CREATE POLICY "Allow public select hearts_guesses" ON public.hearts_guesses FOR SELECT USING (true);
CREATE POLICY "Allow public insert hearts_guesses" ON public.hearts_guesses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update hearts_guesses" ON public.hearts_guesses FOR UPDATE USING (true);
