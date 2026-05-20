# VotaYa

Plataforma moderna de votacion electronica para comites organizacionales, construida con Next.js 15, TypeScript, Tailwind CSS, Supabase, RLS, Storage, React Hook Form, Zod, componentes estilo ShadCN UI, Lucide Icons y Recharts.

## Modulos

- **Publico:** inicio institucional, votacion guiada y resultados en tiempo real.
- **Administrador:** dashboard protegido, CRUD de candidatos, cargos y elecciones.
- **Seguridad:** Supabase Auth, middleware de rutas, validaciones backend, RLS, funciones SQL transaccionales y restricciones unicas contra votos duplicados.
- **Operaciones:** auditoria basica, busqueda, filtros, paginacion, estados vacios, toasts, loaders y exportacion PDF/Excel.

## Configuracion local

1. Instala dependencias:

```bash
npm install
```

2. Copia variables de entorno:

```bash
cp .env.example .env.local
```

3. Crea un proyecto en Supabase y ejecuta `supabase/schema.sql` en el SQL editor.

4. Crea un usuario administrador en Supabase Auth y enlazalo:

```sql
insert into public.users (id, email, full_name, role)
values ('AUTH_USER_UUID', 'admin@organizacion.org', 'Administrador', 'admin');
```

5. Inicia el entorno:

```bash
npm run dev
```

## Variables para Vercel

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

La service role key solo se usa en rutas server-side para conteos y operaciones publicas controladas. No se expone al navegador.

## Estructura principal

- `src/app`: App Router, paginas publicas, admin y APIs.
- `src/components`: UI reusable, layouts, modulos admin, votacion y resultados.
- `src/lib`: Supabase clients, validadores, seguridad, resultados y utilidades.
- `src/types`: tipos de base de datos y dominio.
- `supabase/schema.sql`: esquema PostgreSQL, RLS, Storage, funciones y seed de cargos.

## Produccion

Antes de publicar, confirma que:

- RLS esta habilitado y `schema.sql` corrio completo.
- El bucket `candidate-photos` existe y es publico.
- Realtime esta habilitado para `public.votos`.
- Existe un usuario en Auth vinculado a `public.users` con `role = 'admin'`.
- Las fechas de la eleccion activa cubren la ventana real de votacion.
