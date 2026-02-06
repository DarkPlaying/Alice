-- Test query to check visa_points in profiles table
-- Run this in Supabase SQL Editor to verify your data

-- Check your profile by username
SELECT email, visa_points, wins, losses, created_at
FROM profiles
WHERE email ILIKE '%master%' OR email ILIKE '%school%';

-- If you know your exact email, use:
-- SELECT email, visa_points FROM profiles WHERE email = 'your-email@example.com';
