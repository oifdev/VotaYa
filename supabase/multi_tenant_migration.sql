-- 1. Limpiar datos incompatibles
-- Dado que los cargos ahora deben pertenecer a una eleccion especifica,
-- eliminaremos los datos de prueba actuales para evitar conflictos.
TRUNCATE TABLE public.audit_logs, public.votos, public.votantes, public.candidatos, public.cargos, public.elecciones CASCADE;

-- 2. Modificar la estructura de las tablas

-- Agregar organizer_id a elecciones
ALTER TABLE public.elecciones ADD COLUMN organizer_id uuid REFERENCES public.users(id) ON DELETE CASCADE;
-- Ahora que la tabla esta vacia, podemos hacerlo NOT NULL
ALTER TABLE public.elecciones ALTER COLUMN organizer_id SET NOT NULL;

-- Agregar eleccion_id a cargos y eliminar restricciones globales
ALTER TABLE public.cargos ADD COLUMN eleccion_id uuid REFERENCES public.elecciones(id) ON DELETE CASCADE;
ALTER TABLE public.cargos ALTER COLUMN eleccion_id SET NOT NULL;
ALTER TABLE public.cargos DROP CONSTRAINT IF EXISTS cargos_nombre_key; -- Los nombres de cargo se pueden repetir entre diferentes elecciones
ALTER TABLE public.cargos ADD CONSTRAINT cargos_eleccion_nombre_key UNIQUE (eleccion_id, nombre);

-- 3. Crear el Trigger para Auto-Registro de Usuarios
-- Esto creara un registro en public.users cada vez que alguien se registre en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'admin');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Actualizar la funcion cast_vote para validar cargos por eleccion
CREATE OR REPLACE FUNCTION public.cast_vote(
  p_eleccion_id uuid,
  p_nombre_completo text,
  p_identidad text,
  p_votes jsonb,
  p_ip_address text default null,
  p_user_agent text default null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_election public.elecciones%rowtype;
  v_identity text;
  v_hash text;
  v_voter_id uuid;
  v_required integer;
  v_submitted integer;
  v_vote record;
  v_cargo_id uuid;
  v_candidato_id uuid;
BEGIN
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
  where c.eleccion_id = p_eleccion_id and c.estado = 'activo';

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
END;
$$;

-- 5. Actualizar Politicas RLS (Row Level Security)
-- Ahora el acceso no sera global por rol, sino por propiedad (organizer_id)

-- Users (Cada quien ve y edita su propio perfil)
DROP POLICY IF EXISTS "Admins manage users" ON public.users;
CREATE POLICY "Users manage own profile" ON public.users 
FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Elecciones (Aisladas por organizer_id)
DROP POLICY IF EXISTS "Admins manage elections" ON public.elecciones;
CREATE POLICY "Organizers manage their elections" ON public.elecciones
FOR ALL USING (auth.uid() = organizer_id) WITH CHECK (auth.uid() = organizer_id);

-- Cargos (Solo el dueño de la eleccion los gestiona)
DROP POLICY IF EXISTS "Admins manage cargos" ON public.cargos;
CREATE POLICY "Organizers manage their cargos" ON public.cargos
FOR ALL USING (
  exists (select 1 from public.elecciones e where e.id = eleccion_id and e.organizer_id = auth.uid())
) WITH CHECK (
  exists (select 1 from public.elecciones e where e.id = eleccion_id and e.organizer_id = auth.uid())
);

-- Candidatos
DROP POLICY IF EXISTS "Admins manage candidates" ON public.candidatos;
CREATE POLICY "Organizers manage their candidates" ON public.candidatos
FOR ALL USING (
  exists (select 1 from public.elecciones e where e.id = eleccion_id and e.organizer_id = auth.uid())
) WITH CHECK (
  exists (select 1 from public.elecciones e where e.id = eleccion_id and e.organizer_id = auth.uid())
);

-- Votantes (Solo el organizador puede ver su registro)
DROP POLICY IF EXISTS "Admins read voters" ON public.votantes;
CREATE POLICY "Organizers read voters" ON public.votantes
FOR SELECT USING (
  exists (select 1 from public.elecciones e where e.id = eleccion_id and e.organizer_id = auth.uid())
);

-- Votos (El organizador puede ver los resultados)
DROP POLICY IF EXISTS "Public can read votes for results" ON public.votos;
CREATE POLICY "Organizers read votes for results" ON public.votos
FOR SELECT USING (
  exists (select 1 from public.elecciones e where e.id = eleccion_id and e.organizer_id = auth.uid())
);
-- Nota: Para que los votantes sigan viendo resultados publicos (si asi lo deseas), puedes anadir otra politica FOR SELECT para votos donde la eleccion este finalizada.
CREATE POLICY "Public reads finished election votes" ON public.votos
FOR SELECT USING (
  exists (select 1 from public.elecciones e where e.id = eleccion_id and e.estado = 'finalizada')
);

-- Auditoria
DROP POLICY IF EXISTS "Admins read audit logs" ON public.audit_logs;
CREATE POLICY "Organizers read audit logs" ON public.audit_logs
FOR SELECT USING (
  actor_id = auth.uid() OR exists (
    select 1 from public.elecciones e where (metadata->>'eleccion_id')::uuid = e.id and e.organizer_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins create audit logs" ON public.audit_logs;
CREATE POLICY "Any auth user creates audit logs" ON public.audit_logs
FOR INSERT WITH CHECK (auth.uid() is not null);

-- Storage (Candidate Photos)
DROP POLICY IF EXISTS "Admins upload candidate photos" ON storage.objects;
CREATE POLICY "Organizers upload candidate photos" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'candidate-photos' and auth.uid() is not null);

DROP POLICY IF EXISTS "Admins update candidate photos" ON storage.objects;
CREATE POLICY "Organizers update candidate photos" ON storage.objects
FOR UPDATE USING (bucket_id = 'candidate-photos' and auth.uid() is not null);

DROP POLICY IF EXISTS "Admins delete candidate photos" ON storage.objects;
CREATE POLICY "Organizers delete candidate photos" ON storage.objects
FOR DELETE USING (bucket_id = 'candidate-photos' and auth.uid() is not null);
