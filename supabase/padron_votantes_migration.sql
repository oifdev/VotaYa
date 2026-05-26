-- Padron de votantes (registro de identidades habilitadas para votar)
-- Requerimiento:
-- 1) El votante SOLO ingresa su identidad.
-- 2) El sistema valida que exista en el padron (por eleccion) y resuelve el nombre.
-- 3) Si ya voto, se bloquea y se informa.
--
-- Ejecutar este script en el SQL Editor de Supabase (sobre una BD basada en schema2.sql / schema1.sql).

-- 1) Tabla: padron_votantes (solo admins pueden administrarla)
create table if not exists public.padron_votantes (
  id uuid primary key default gen_random_uuid(),
  eleccion_id uuid not null references public.elecciones(id) on delete cascade,
  nombre_completo text not null,
  identidad_hash text not null,
  identidad_masked text not null,
  estado public.record_status not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint padron_votantes_nombre_len check (char_length(trim(nombre_completo)) >= 5),
  constraint padron_votantes_hash_len check (char_length(identidad_hash) = 64)
);

create unique index if not exists padron_votantes_eleccion_identidad_hash_idx
  on public.padron_votantes (eleccion_id, identidad_hash);

drop trigger if exists padron_votantes_set_updated_at on public.padron_votantes;
create trigger padron_votantes_set_updated_at
before update on public.padron_votantes
for each row execute function public.set_updated_at();

alter table public.padron_votantes enable row level security;

drop policy if exists "Admins manage padron voters" on public.padron_votantes;
create policy "Admins manage padron voters"
on public.padron_votantes for all
using (public.is_admin())
with check (public.is_admin());

-- Si tu esquema es multi-tenant (elecciones con organizer_id) y quieres que cada organizador
-- pueda administrar SOLO el padron de sus elecciones, descomenta estas politicas y elimina
-- la politica de admin anterior (o dejalas en paralelo si mantienes admins globales).
--
-- drop policy if exists "Organizers manage their padron voters" on public.padron_votantes;
-- create policy "Organizers manage their padron voters"
-- on public.padron_votantes for all
-- using (
--   exists (
--     select 1
--     from public.elecciones e
--     where e.id = eleccion_id
--       and e.organizer_id = auth.uid()
--   )
-- )
-- with check (
--   exists (
--     select 1
--     from public.elecciones e
--     where e.id = eleccion_id
--       and e.organizer_id = auth.uid()
--   )
-- );

-- Asegurar que los roles puedan "llegar" a la tabla (RLS sigue aplicando).
grant all on table public.padron_votantes to anon, authenticated, service_role;

-- 2) Endurecer la transaccion de voto: exigir identidad registrada en el padron.
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
  v_padron_nombre text;
  v_padron_estado public.record_status;
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

  if jsonb_typeof(p_votes) <> 'array' then
    raise exception 'La seleccion de votos es invalida.';
  end if;

  select count(*) into v_required
  from public.cargos c
  where c.eleccion_id = p_eleccion_id
    and c.estado = 'activo';

  select count(distinct (item->>'cargo_id')) into v_submitted
  from jsonb_array_elements(p_votes) as item;

  if v_required = 0 or v_submitted <> v_required then
    raise exception 'Debe asignar un candidato a cada cargo disponible.';
  end if;

  v_hash := public.hash_identity(v_identity);

  -- Validar identidad contra el padron (no se permite votar si no esta registrada).
  select pv.nombre_completo, pv.estado
    into v_padron_nombre, v_padron_estado
  from public.padron_votantes pv
  where pv.eleccion_id = p_eleccion_id
    and pv.identidad_hash = v_hash
  limit 1;

  if not found then
    raise exception 'Identidad no registrada para esta eleccion.';
  end if;

  if v_padron_estado <> 'activo' then
    raise exception 'Esta identidad se encuentra inactiva para votar.';
  end if;

  -- Si el cliente envia nombre, lo normalizamos y lo validamos contra el padron.
  -- (El frontend nuevo ya no pide nombre; se resuelve desde padron en /api/voting/validate).
  if char_length(trim(coalesce(p_nombre_completo, ''))) >= 1 then
    if regexp_replace(trim(p_nombre_completo), '\s+', ' ', 'g')
       <> regexp_replace(trim(v_padron_nombre), '\s+', ' ', 'g') then
      raise exception 'El nombre no coincide con el registro del padron.';
    end if;
  end if;

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
    regexp_replace(trim(v_padron_nombre), '\s+', ' ', 'g'),
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
    v_cargo_id := v_vote.cargo_id;
    v_candidato_id := v_vote.candidato_id;

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
        and c.eleccion_id = p_eleccion_id
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

grant all on function public.cast_vote(uuid, text, text, jsonb, text, text) to anon, authenticated, service_role;

-- Ejemplo de insercion (usa hash/mask en DB; no guardamos identidad en claro):
-- insert into public.padron_votantes (eleccion_id, nombre_completo, identidad_hash, identidad_masked, estado)
-- values (
--   '<UUID_ELECCION>',
--   'NOMBRE COMPLETO',
--   public.hash_identity('0000-0000-00000'),
--   public.mask_identity('0000-0000-00000'),
--   'activo'
-- );
