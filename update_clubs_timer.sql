-- Add phase_expiry for time synchronization
ALTER TABLE clubs_game_status 
ADD COLUMN IF NOT EXISTS phase_expiry TIMESTAMPTZ;
