-- 1. Create a Trigger Function to automatically add new users to profiles
-- This ensures that ANY new user (Player or Master) gets a Global ID immediately.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, created_at)
  values (new.id, new.raw_user_meta_data->>'username', new.created_at);
  return new;
end;
$$ language plpgsql security definer;

-- 2. Create the Trigger on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. BACKFILL AGAIN (Crucial for fixing current mismatch)
-- This adds the missing "Master" account to the profiles table.
insert into public.profiles (id, username, created_at)
select id, raw_user_meta_data->>'username', created_at
from auth.users
on conflict (id) do nothing;
