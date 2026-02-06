-- Set default visa_points to 1000 for all users
UPDATE profiles 
SET visa_points = 1000 
WHERE visa_points IS NULL OR visa_points = 0;

-- Optional: Set ALL users to exactly 1000 (use this if you want to reset everyone)
-- UPDATE profiles SET visa_points = 1000;

-- Verify the update
SELECT id, email, username, visa_points 
FROM profiles 
ORDER BY visa_points DESC;
