-- Restaurar politicas de lectura publica para Votos y Votantes
-- Esto es necesario para que la pagina de resultados (anonima) pueda contar los votos y calcular participacion.

-- 1. Permitir lectura publica en la tabla votos
DROP POLICY IF EXISTS "Public can read votes" ON public.votos;
CREATE POLICY "Public can read votes" 
ON public.votos
FOR SELECT 
TO public 
USING (true);

-- 2. Permitir lectura publica en la tabla votantes (necesario para el conteo de participacion)
DROP POLICY IF EXISTS "Public can read voters" ON public.votantes;
CREATE POLICY "Public can read voters" 
ON public.votantes
FOR SELECT 
TO public 
USING (true);
