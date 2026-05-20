-- VotaYa - Supabase schema, RLS, storage policies and vote transaction functions.
-- Run this file in the Supabase SQL editor before deploying the app.

create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('admin', 'auditor');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.record_status as enum ('activo', 'inactivo');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.election_status as enum ('pendiente', 'activa', 'finalizada');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.user_role not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.elecciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  fecha_inicio timestamptz not null,
  fecha_cierre timestamptz not null,
  estado public.election_status not null default 'pendiente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint elecciones_nombre_len check (char_length(trim(nombre)) >= 4),
  constraint elecciones_fechas_validas check (fecha_cierre > fecha_inicio)
);

create unique index if not exists elecciones_only_one_active_idx
  on public.elecciones ((estado))
  where estado = 'activa';

create table if not exists public.cargos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  max_candidatos integer not null default 5,
  estado public.record_status not null default 'activo',
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cargos_nombre_len check (char_length(trim(nombre)) >= 3),
  constraint cargos_max_candidatos_valid check (max_candidatos between 1 and 50),
  constraint cargos_orden_valid check (orden >= 0)
);

create table if not exists public.candidatos (
  id uuid primary key default gen_random_uuid(),
  eleccion_id uuid not null references public.elecciones(id) on delete cascade,
  nombre_completo text not null,
  identidad text not null,
  biografia text,
  foto_url text,
  estado public.record_status not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidatos_nombre_len check (char_length(trim(nombre_completo)) >= 5),
  constraint candidatos_identidad_format check (identidad ~ '^\d{4}-?\d{4}-?\d{5}$')
);

create unique index if not exists candidatos_identidad_eleccion_idx
  on public.candidatos (eleccion_id, identidad);

create table if not exists public.votantes (
  id uuid primary key default gen_random_uuid(),
  eleccion_id uuid not null references public.elecciones(id) on delete cascade,
  nombre_completo text not null,
  identidad_hash text not null,
  identidad_masked text not null,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint votantes_nombre_len check (char_length(trim(nombre_completo)) >= 5)
);

create unique index if not exists votantes_eleccion_identidad_hash_idx
  on public.votantes (eleccion_id, identidad_hash);

create table if not exists public.votos (
  id uuid primary key default gen_random_uuid(),
  eleccion_id uuid not null references public.elecciones(id) on delete cascade,
  votante_id uuid not null references public.votantes(id) on delete cascade,
  cargo_id uuid not null references public.cargos(id) on delete restrict,
  candidato_id uuid not null references public.candidatos(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index if not exists votos_one_per_cargo_idx
  on public.votos (votante_id, cargo_id);

create index if not exists votos_resultados_idx
  on public.votos (eleccion_id, cargo_id, candidato_id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists elecciones_set_updated_at on public.elecciones;
create trigger elecciones_set_updated_at
before update on public.elecciones
for each row execute function public.set_updated_at();

drop trigger if exists cargos_set_updated_at on public.cargos;
create trigger cargos_set_updated_at
before update on public.cargos
for each row execute function public.set_updated_at();

drop trigger if exists candidatos_set_updated_at on public.candidatos;
create trigger candidatos_set_updated_at
before update on public.candidatos
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- Trigger y funcion enforce_max_candidates eliminados ya que los candidatos no estan vinculados a cargos especificos en el registro.

create or replace function public.clean_identity(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(value, ''), '\D', '', 'g');
$$;

-- pgcrypto must be enabled for this function to work
create or replace function public.hash_identity(value text)
returns text
language sql
immutable
as $$
  select encode(digest(public.clean_identity(value), 'sha256'), 'hex');
$$;

create or replace function public.mask_identity(value text)
returns text
language sql
immutable
as $$
  select '****-****-' || right(public.clean_identity(value), 5);
$$;

create or replace function public.has_voted(
  p_eleccion_id uuid,
  p_identidad text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.votantes
    where eleccion_id = p_eleccion_id
      and identidad_hash = public.hash_identity(p_identidad)
  );
$$;

create or replace function public.cast_vote(
  p_eleccion_id uuid,
  p_nombre_completo text,
  p_identidad text,
  p_votes jsonb,
  p_ip_address text default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_election public.elecciones%rowtype;
  v_identity text;
  v_hash text;
  v_voter_id uuid;
  v_required integer;
  v_submitted integer;
  v_vote record;
  v_cargo_id uuid;
  v_candidato_id uuid;
begin
  select * into v_election
  from public.elecciones
  where id = p_eleccion_id
    and estado = 'activa'
    and now() between fecha_inicio and fecha_cierre;

  if not found then
    raise exception 'La eleccion no esta activa.';
  end if;

  v_identity := public.clean_identity(p_identidad);

  if v_identity !~ '^\d{13}$' then
    raise exception 'Numero de identidad invalido.';
  end if;

  if char_length(trim(coalesce(p_nombre_completo, ''))) < 5 then
    raise exception 'Nombre completo invalido.';
  end if;

  if jsonb_typeof(p_votes) <> 'array' then
    raise exception 'La seleccion de votos es invalida.';
  end if;

  select count(*) into v_required
  from public.cargos c
  where c.estado = 'activo';

  select count(distinct (item->>'cargo_id')) into v_submitted
  from jsonb_array_elements(p_votes) as item;

  if v_required = 0 or v_submitted <> v_required then
    raise exception 'Debe asignar un candidato a cada cargo disponible.';
  end if;

  v_hash := public.hash_identity(v_identity);

  if exists (
    select 1
    from public.votantes
    where eleccion_id = p_eleccion_id
      and identidad_hash = v_hash
  ) then
    raise exception 'Esta identidad ya registro su voto en esta eleccion.';
  end if;

  insert into public.votantes (
    eleccion_id,
    nombre_completo,
    identidad_hash,
    identidad_masked,
    ip_address,
    user_agent
  )
  values (
    p_eleccion_id,
    regexp_replace(trim(p_nombre_completo), '\s+', ' ', 'g'),
    v_hash,
    public.mask_identity(v_identity),
    nullif(p_ip_address, '')::inet,
    nullif(p_user_agent, '')
  )
  returning id into v_voter_id;

  for v_vote in
    select *
    from jsonb_to_recordset(p_votes) as x(cargo_id uuid, candidato_id uuid)
  loop
    -- extract fields to scalar variables (needed for sub‑queries)
    v_cargo_id uuid := v_vote.cargo_id;
    v_candidato_id uuid := v_vote.candidato_id;

    if not exists (
      select 1
      from public.candidatos ca
      where ca.id = v_candidato_id
        and ca.eleccion_id = p_eleccion_id
        and ca.estado = 'activo'
    ) or not exists (
      select 1
      from public.cargos c
      where c.id = v_cargo_id
        and c.estado = 'activo'
    ) then
      raise exception 'La seleccion contiene un candidato o cargo invalido.';
    end if;

    insert into public.votos (
      eleccion_id,
      votante_id,
      cargo_id,
      candidato_id
    )
    values (
      p_eleccion_id,
      v_voter_id,
      v_cargo_id,
      v_candidato_id
    );
  end loop;

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata,
    ip_address
  )
  values (
    null,
    'vote.cast',
    'votante',
    v_voter_id,
    jsonb_build_object('eleccion_id', p_eleccion_id, 'cargos', v_required),
    nullif(p_ip_address, '')::inet
  );

  return v_voter_id;
exception
  when unique_violation then
    raise exception 'Esta identidad ya registro su voto en esta eleccion.';
end;
$$;

alter table public.users enable row level security;
alter table public.elecciones enable row level security;
alter table public.cargos enable row level security;
alter table public.candidatos enable row level security;
alter table public.votantes enable row level security;
alter table public.votos enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Users can read own profile" on public.users;
create policy "Users can read own profile"
on public.users for select
using (auth.uid() = id or public.is_admin());

drop policy if exists "Admins manage users" on public.users;
create policy "Admins manage users"
on public.users for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read visible elections" on public.elecciones;
create policy "Public can read visible elections"
on public.elecciones for select
using (estado in ('activa', 'finalizada') or public.is_admin());

drop policy if exists "Admins manage elections" on public.elecciones;
create policy "Admins manage elections"
on public.elecciones for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read active cargos" on public.cargos;
create policy "Public can read active cargos"
on public.cargos for select
using (estado = 'activo' or public.is_admin());

drop policy if exists "Admins manage cargos" on public.cargos;
create policy "Admins manage cargos"
on public.cargos for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read visible candidates" on public.candidatos;
create policy "Public can read visible candidates"
on public.candidatos for select
using (
  public.is_admin()
  or (
    estado = 'activo'
    and exists (
      select 1
      from public.elecciones e
      where e.id = eleccion_id
        and e.estado in ('activa', 'finalizada')
    )
  )
);

drop policy if exists "Admins manage candidates" on public.candidatos;
create policy "Admins manage candidates"
on public.candidatos for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins read voters" on public.votantes;
create policy "Admins read voters"
on public.votantes for select
using (public.is_admin());

drop policy if exists "Public can read votes for results" on public.votos;
create policy "Public can read votes for results"
on public.votos for select
using (
  public.is_admin()
  or exists (
    select 1
    from public.elecciones e
    where e.id = eleccion_id
      and e.estado in ('activa', 'finalizada')
  )
);

drop policy if exists "Admins read audit logs" on public.audit_logs;
create policy "Admins read audit logs"
on public.audit_logs for select
using (public.is_admin());

drop policy if exists "Admins create audit logs" on public.audit_logs;
create policy "Admins create audit logs"
on public.audit_logs for insert
with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.elecciones, public.cargos, public.candidatos, public.votos to anon, authenticated;
grant select, insert, update, delete on public.elecciones, public.cargos, public.candidatos, public.audit_logs to authenticated;
grant select on public.users, public.votantes to authenticated;
grant execute on function public.has_voted(uuid, text) to anon, authenticated;
grant execute on function public.cast_vote(uuid, text, text, jsonb, text, text) to anon, authenticated;

insert into public.cargos (nombre, descripcion, max_candidatos, orden)
values
  ('Presidente', 'Direccion general del comite.', 8, 1),
  ('Secretario', 'Gestion documental y actas.', 8, 2),
  ('Vocal I', 'Representacion y apoyo operativo.', 8, 3),
  ('Vocal II', 'Representacion y apoyo operativo.', 8, 4),
  ('Tesorero', 'Gestion financiera interna.', 8, 5),
  ('Fiscal', 'Supervision y cumplimiento.', 8, 6)
on conflict (nombre) do nothing;

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

drop policy if exists "Admins upload candidate photos" on storage.objects;
create policy "Admins upload candidate photos"
on storage.objects for insert
with check (bucket_id = 'candidate-photos' and public.is_admin());

drop policy if exists "Admins update candidate photos" on storage.objects;
create policy "Admins update candidate photos"
on storage.objects for update
using (bucket_id = 'candidate-photos' and public.is_admin())
with check (bucket_id = 'candidate-photos' and public.is_admin());

drop policy if exists "Admins delete candidate photos" on storage.objects;
create policy "Admins delete candidate photos"
on storage.objects for delete
using (bucket_id = 'candidate-photos' and public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.votos;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- After creating an admin in Supabase Auth, link it with:
-- insert into public.users (id, email, full_name, role)
-- values ('AUTH_USER_UUID', 'admin@organizacion.org', 'Administrador', 'admin');
