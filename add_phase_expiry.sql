-- Add phase_expiry column to clubs_game_status
ALTER TABLE clubs_game_status 
ADD COLUMN IF NOT EXISTS phase_expiry TIMESTAMPTZ;

-- Add updated_at if missing
ALTER TABLE clubs_game_status 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
