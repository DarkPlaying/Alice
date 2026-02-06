-- Ensure profiles table exists
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- OPEN ACCESS POLICY (Vital for Game ID mapping consistency between Admin/Player)
drop policy if exists "Public profiles are viewable by everyone" on profiles;
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using ( true );

-- Policy to allow users to insert their own profile
drop policy if exists "Users can insert their own profile" on profiles;
create policy "Users can insert their own profile"
  on profiles for insert
  with check ( auth.uid() = id );

-- Policy to allow users to update their own profile
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

-- Backfill from Auth (Idempotent)
-- This ensures that historical users (like the ones Admin sees) are present in the profiles table
-- so that ClubsGame calculates the same IDs.
insert into public.profiles (id, username, created_at)
select id, raw_user_meta_data->>'username', created_at
from auth.users
on conflict (id) do nothing;
