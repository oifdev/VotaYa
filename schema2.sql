


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."election_status" AS ENUM (
    'pendiente',
    'activa',
    'finalizada'
);


ALTER TYPE "public"."election_status" OWNER TO "postgres";


CREATE TYPE "public"."record_status" AS ENUM (
    'activo',
    'inactivo'
);


ALTER TYPE "public"."record_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'auditor'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cast_vote"("p_eleccion_id" "uuid", "p_nombre_completo" "text", "p_identidad" "text", "p_votes" "jsonb", "p_ip_address" "text" DEFAULT NULL::"text", "p_user_agent" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."cast_vote"("p_eleccion_id" "uuid", "p_nombre_completo" "text", "p_identidad" "text", "p_votes" "jsonb", "p_ip_address" "text", "p_user_agent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clean_identity"("value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select regexp_replace(coalesce(value, ''), '\D', '', 'g');
$$;


ALTER FUNCTION "public"."clean_identity"("value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_voted"("p_eleccion_id" "uuid", "p_identidad" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.votantes
    where eleccion_id = p_eleccion_id
      and identidad_hash = public.hash_identity(p_identidad)
  );
$$;


ALTER FUNCTION "public"."has_voted"("p_eleccion_id" "uuid", "p_identidad" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hash_identity"("value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE SECURITY DEFINER
    AS $$
  -- Se fuerza a que 'sha256' sea interpretado estrictamente como text
  SELECT encode(extensions.digest(public.clean_identity(value), 'sha256'::text), 'hex');
$$;


ALTER FUNCTION "public"."hash_identity"("value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mask_identity"("value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select '****-****-' || right(public.clean_identity(value), 5);
$$;


ALTER FUNCTION "public"."mask_identity"("value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "metadata" "jsonb",
    "ip_address" "inet",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidatos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "eleccion_id" "uuid" NOT NULL,
    "nombre_completo" "text" NOT NULL,
    "identidad" "text" NOT NULL,
    "biografia" "text",
    "foto_url" "text",
    "estado" "public"."record_status" DEFAULT 'activo'::"public"."record_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "candidatos_identidad_format" CHECK (("identidad" ~ '^\d{4}-?\d{4}-?\d{5}$'::"text")),
    CONSTRAINT "candidatos_nombre_len" CHECK (("char_length"(TRIM(BOTH FROM "nombre_completo")) >= 5))
);


ALTER TABLE "public"."candidatos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cargos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "max_candidatos" integer DEFAULT 5 NOT NULL,
    "estado" "public"."record_status" DEFAULT 'activo'::"public"."record_status" NOT NULL,
    "orden" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "eleccion_id" "uuid" NOT NULL,
    CONSTRAINT "cargos_max_candidatos_valid" CHECK ((("max_candidatos" >= 1) AND ("max_candidatos" <= 50))),
    CONSTRAINT "cargos_nombre_len" CHECK (("char_length"(TRIM(BOTH FROM "nombre")) >= 3)),
    CONSTRAINT "cargos_orden_valid" CHECK (("orden" >= 0))
);


ALTER TABLE "public"."cargos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."elecciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "fecha_inicio" timestamp with time zone NOT NULL,
    "fecha_cierre" timestamp with time zone NOT NULL,
    "estado" "public"."election_status" DEFAULT 'pendiente'::"public"."election_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    CONSTRAINT "elecciones_fechas_validas" CHECK (("fecha_cierre" > "fecha_inicio")),
    CONSTRAINT "elecciones_nombre_len" CHECK (("char_length"(TRIM(BOTH FROM "nombre")) >= 4))
);


ALTER TABLE "public"."elecciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "role" "public"."user_role" DEFAULT 'admin'::"public"."user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."votantes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "eleccion_id" "uuid" NOT NULL,
    "nombre_completo" "text" NOT NULL,
    "identidad_hash" "text" NOT NULL,
    "identidad_masked" "text" NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "votantes_nombre_len" CHECK (("char_length"(TRIM(BOTH FROM "nombre_completo")) >= 5))
);


ALTER TABLE "public"."votantes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."votos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "eleccion_id" "uuid" NOT NULL,
    "votante_id" "uuid" NOT NULL,
    "cargo_id" "uuid" NOT NULL,
    "candidato_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."votos" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidatos"
    ADD CONSTRAINT "candidatos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cargos"
    ADD CONSTRAINT "cargos_eleccion_nombre_key" UNIQUE ("eleccion_id", "nombre");



ALTER TABLE ONLY "public"."cargos"
    ADD CONSTRAINT "cargos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."elecciones"
    ADD CONSTRAINT "elecciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."votantes"
    ADD CONSTRAINT "votantes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."votos"
    ADD CONSTRAINT "votos_pkey" PRIMARY KEY ("id");



CREATE INDEX "audit_logs_created_at_idx" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "candidatos_identidad_eleccion_idx" ON "public"."candidatos" USING "btree" ("eleccion_id", "identidad");



CREATE UNIQUE INDEX "elecciones_only_one_active_idx" ON "public"."elecciones" USING "btree" ("estado") WHERE ("estado" = 'activa'::"public"."election_status");



CREATE UNIQUE INDEX "votantes_eleccion_identidad_hash_idx" ON "public"."votantes" USING "btree" ("eleccion_id", "identidad_hash");



CREATE UNIQUE INDEX "votos_one_per_cargo_idx" ON "public"."votos" USING "btree" ("votante_id", "cargo_id");



CREATE INDEX "votos_resultados_idx" ON "public"."votos" USING "btree" ("eleccion_id", "cargo_id", "candidato_id");



CREATE OR REPLACE TRIGGER "candidatos_set_updated_at" BEFORE UPDATE ON "public"."candidatos" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "cargos_set_updated_at" BEFORE UPDATE ON "public"."cargos" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "elecciones_set_updated_at" BEFORE UPDATE ON "public"."elecciones" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "users_set_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."candidatos"
    ADD CONSTRAINT "candidatos_eleccion_id_fkey" FOREIGN KEY ("eleccion_id") REFERENCES "public"."elecciones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cargos"
    ADD CONSTRAINT "cargos_eleccion_id_fkey" FOREIGN KEY ("eleccion_id") REFERENCES "public"."elecciones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."elecciones"
    ADD CONSTRAINT "elecciones_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."votantes"
    ADD CONSTRAINT "votantes_eleccion_id_fkey" FOREIGN KEY ("eleccion_id") REFERENCES "public"."elecciones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."votos"
    ADD CONSTRAINT "votos_candidato_id_fkey" FOREIGN KEY ("candidato_id") REFERENCES "public"."candidatos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."votos"
    ADD CONSTRAINT "votos_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "public"."cargos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."votos"
    ADD CONSTRAINT "votos_eleccion_id_fkey" FOREIGN KEY ("eleccion_id") REFERENCES "public"."elecciones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."votos"
    ADD CONSTRAINT "votos_votante_id_fkey" FOREIGN KEY ("votante_id") REFERENCES "public"."votantes"("id") ON DELETE CASCADE;



CREATE POLICY "Admins manage all candidatos" ON "public"."candidatos" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins manage all cargos" ON "public"."cargos" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins manage all elections" ON "public"."elecciones" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins read all audit logs" ON "public"."audit_logs" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins read all voters" ON "public"."votantes" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins read all votes" ON "public"."votos" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Any auth user creates audit logs" ON "public"."audit_logs" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Organizers manage their candidates" ON "public"."candidatos" USING ((EXISTS ( SELECT 1
   FROM "public"."elecciones" "e"
  WHERE (("e"."id" = "candidatos"."eleccion_id") AND ("e"."organizer_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."elecciones" "e"
  WHERE (("e"."id" = "candidatos"."eleccion_id") AND ("e"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Organizers manage their cargos" ON "public"."cargos" USING ((EXISTS ( SELECT 1
   FROM "public"."elecciones" "e"
  WHERE (("e"."id" = "cargos"."eleccion_id") AND ("e"."organizer_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."elecciones" "e"
  WHERE (("e"."id" = "cargos"."eleccion_id") AND ("e"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Organizers manage their elections" ON "public"."elecciones" USING (("auth"."uid"() = "organizer_id")) WITH CHECK (("auth"."uid"() = "organizer_id"));



CREATE POLICY "Organizers read audit logs" ON "public"."audit_logs" FOR SELECT USING ((("actor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."elecciones" "e"
  WHERE (((("audit_logs"."metadata" ->> 'eleccion_id'::"text"))::"uuid" = "e"."id") AND ("e"."organizer_id" = "auth"."uid"()))))));



CREATE POLICY "Organizers read voters" ON "public"."votantes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."elecciones" "e"
  WHERE (("e"."id" = "votantes"."eleccion_id") AND ("e"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Organizers read votes for results" ON "public"."votos" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."elecciones" "e"
  WHERE (("e"."id" = "votos"."eleccion_id") AND ("e"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Public can read active cargos" ON "public"."cargos" FOR SELECT USING ((("estado" = 'activo'::"public"."record_status") OR "public"."is_admin"()));



CREATE POLICY "Public can read visible candidates" ON "public"."candidatos" FOR SELECT USING (("public"."is_admin"() OR (("estado" = 'activo'::"public"."record_status") AND (EXISTS ( SELECT 1
   FROM "public"."elecciones" "e"
  WHERE (("e"."id" = "candidatos"."eleccion_id") AND ("e"."estado" = ANY (ARRAY['activa'::"public"."election_status", 'finalizada'::"public"."election_status"]))))))));



CREATE POLICY "Public can read visible elections" ON "public"."elecciones" FOR SELECT USING ((("estado" = ANY (ARRAY['activa'::"public"."election_status", 'finalizada'::"public"."election_status"])) OR "public"."is_admin"()));



CREATE POLICY "Public can read voters" ON "public"."votantes" FOR SELECT USING (true);



CREATE POLICY "Public can read votes" ON "public"."votos" FOR SELECT USING (true);



CREATE POLICY "Public reads finished election votes" ON "public"."votos" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."elecciones" "e"
  WHERE (("e"."id" = "votos"."eleccion_id") AND ("e"."estado" = 'finalizada'::"public"."election_status")))));



CREATE POLICY "Users can read own profile" ON "public"."users" FOR SELECT USING ((("auth"."uid"() = "id") OR "public"."is_admin"()));



CREATE POLICY "Users manage own profile" ON "public"."users" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidatos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cargos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."elecciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."votantes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."votos" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."votos";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."cast_vote"("p_eleccion_id" "uuid", "p_nombre_completo" "text", "p_identidad" "text", "p_votes" "jsonb", "p_ip_address" "text", "p_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cast_vote"("p_eleccion_id" "uuid", "p_nombre_completo" "text", "p_identidad" "text", "p_votes" "jsonb", "p_ip_address" "text", "p_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cast_vote"("p_eleccion_id" "uuid", "p_nombre_completo" "text", "p_identidad" "text", "p_votes" "jsonb", "p_ip_address" "text", "p_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."clean_identity"("value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."clean_identity"("value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."clean_identity"("value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_voted"("p_eleccion_id" "uuid", "p_identidad" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_voted"("p_eleccion_id" "uuid", "p_identidad" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_voted"("p_eleccion_id" "uuid", "p_identidad" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hash_identity"("value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hash_identity"("value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hash_identity"("value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mask_identity"("value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mask_identity"("value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mask_identity"("value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."candidatos" TO "anon";
GRANT ALL ON TABLE "public"."candidatos" TO "authenticated";
GRANT ALL ON TABLE "public"."candidatos" TO "service_role";



GRANT ALL ON TABLE "public"."cargos" TO "anon";
GRANT ALL ON TABLE "public"."cargos" TO "authenticated";
GRANT ALL ON TABLE "public"."cargos" TO "service_role";



GRANT ALL ON TABLE "public"."elecciones" TO "anon";
GRANT ALL ON TABLE "public"."elecciones" TO "authenticated";
GRANT ALL ON TABLE "public"."elecciones" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."votantes" TO "anon";
GRANT ALL ON TABLE "public"."votantes" TO "authenticated";
GRANT ALL ON TABLE "public"."votantes" TO "service_role";



GRANT ALL ON TABLE "public"."votos" TO "anon";
GRANT ALL ON TABLE "public"."votos" TO "authenticated";
GRANT ALL ON TABLE "public"."votos" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































