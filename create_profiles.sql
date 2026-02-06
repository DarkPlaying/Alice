-- Create profiles table if it doesn't exist
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policy to allow everyone to read profiles (needed for ID mapping)
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

-- Function to handle new user signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- BACKFILL: Insert existing users from auth.users into profiles
insert into public.profiles (id, username)
select id, raw_user_meta_data->>'username'
from auth.users
on conflict (id) do nothing;
