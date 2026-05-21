-- Revertir a arquitectura Single-Tenant

-- 1. Eliminar la columna de código de acceso si existe
ALTER TABLE public.elecciones DROP COLUMN IF EXISTS codigo_acceso;

-- 2. Actualizar las Políticas de Seguridad (RLS) para permitir a cualquier usuario autenticado acceso total.

-- Elecciones
DROP POLICY IF EXISTS "Organizers can manage their own elections" ON public.elecciones;
CREATE POLICY "Authenticated users can manage all elections" 
ON public.elecciones
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Cargos
DROP POLICY IF EXISTS "Organizers can manage cargos of their elections" ON public.cargos;
CREATE POLICY "Authenticated users can manage all cargos" 
ON public.cargos
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Candidatos
DROP POLICY IF EXISTS "Organizers can manage candidates of their elections" ON public.candidatos;
CREATE POLICY "Authenticated users can manage all candidates" 
ON public.candidatos
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Votantes
DROP POLICY IF EXISTS "Organizers can view voters of their elections" ON public.votantes;
CREATE POLICY "Authenticated users can view all voters" 
ON public.votantes
FOR SELECT 
TO authenticated 
USING (true);

-- Votos
DROP POLICY IF EXISTS "Organizers can view votes of their elections" ON public.votos;
CREATE POLICY "Authenticated users can view all votes" 
ON public.votos
FOR SELECT 
TO authenticated 
USING (true);

-- Audit Logs
DROP POLICY IF EXISTS "Organizers can view audit logs of their elections" ON public.audit_logs;
CREATE POLICY "Authenticated users can view all audit logs" 
ON public.audit_logs
FOR SELECT 
TO authenticated 
USING (true);

-- Users (Registro de admins)
DROP POLICY IF EXISTS "Users can read their own profile" ON public.users;
CREATE POLICY "Authenticated users can read all profiles" 
ON public.users
FOR SELECT 
TO authenticated 
USING (true);

-- Nota: La función cast_vote todavía espera y verifica que los cargos y candidatos pertenezcan a la elección activa.
-- Esa lógica de integridad de base de datos se mantiene porque es buena práctica, 
-- independientemente de si hay un solo organizador o muchos.
