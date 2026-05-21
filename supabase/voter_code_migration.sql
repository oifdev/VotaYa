-- Agregar la columna codigo_acceso a la tabla elecciones
ALTER TABLE public.elecciones ADD COLUMN codigo_acceso varchar(10);

-- Para las elecciones existentes, generamos un codigo temporal usando su ID
UPDATE public.elecciones 
SET codigo_acceso = upper(substring(replace(id::text, '-', ''), 1, 6))
WHERE codigo_acceso IS NULL;

-- Hacemos la columna NOT NULL y unica
ALTER TABLE public.elecciones ALTER COLUMN codigo_acceso SET NOT NULL;
ALTER TABLE public.elecciones ADD CONSTRAINT elecciones_codigo_acceso_key UNIQUE (codigo_acceso);

-- Actualizar la vista de las políticas para asegurar que los votantes públicos puedan usar el código
-- La política existente "Public can read visible elections" en elecciones permite a los usuarios
-- ver elecciones activas o finalizadas. Al agregar esta columna, podrán leer el código de acceso.
