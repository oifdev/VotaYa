-- VotaYa auth hardening patch.
-- Run this once in the Supabase SQL editor if your database was created from schema1.sql.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'admin'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.users.full_name, excluded.full_name),
      role = coalesce(public.users.role, excluded.role),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles for auth users that were created before the trigger existed.
insert into public.users (id, email, full_name, role)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'full_name', email),
  'admin'
from auth.users
on conflict (id) do update
set email = excluded.email,
    full_name = coalesce(public.users.full_name, excluded.full_name),
    role = coalesce(public.users.role, excluded.role),
    updated_at = now();

-- Keep storage usable for authenticated organizers when not using service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-photos',
  'candidate-photos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads candidate photos" on storage.objects;
create policy "Public reads candidate photos"
on storage.objects for select
using (bucket_id = 'candidate-photos');

drop policy if exists "Organizers upload candidate photos" on storage.objects;
create policy "Organizers upload candidate photos"
on storage.objects for insert
with check (bucket_id = 'candidate-photos' and auth.uid() is not null);

drop policy if exists "Organizers update candidate photos" on storage.objects;
create policy "Organizers update candidate photos"
on storage.objects for update
using (bucket_id = 'candidate-photos' and auth.uid() is not null)
with check (bucket_id = 'candidate-photos' and auth.uid() is not null);

drop policy if exists "Organizers delete candidate photos" on storage.objects;
create policy "Organizers delete candidate photos"
on storage.objects for delete
using (bucket_id = 'candidate-photos' and auth.uid() is not null);
