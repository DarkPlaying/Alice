-- Add is_active column to hearts_game_state to fix Admin Start error
ALTER TABLE public.hearts_game_state 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Ensure the column is accessible
GRANT UPDATE(is_active) ON public.hearts_game_state TO anon, authenticated, service_role;
