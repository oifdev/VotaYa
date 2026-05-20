# Arquitectura de VotaYa

## Capas

- **Next.js App Router:** separa rutas publicas (`/`, `/votar`, `/resultados`) y rutas protegidas (`/admin`).
- **Supabase Auth:** login del administrador con email/password.
- **Middleware:** valida sesion y rol `admin` antes de permitir `/admin`.
- **API routes:** centralizan CRUD, validaciones backend, votos y resultados.
- **PostgreSQL + RLS:** las tablas tienen politicas por rol y funciones `security definer` para operaciones sensibles.
- **Supabase Storage:** bucket `candidate-photos` para fotografias de candidatos.
- **Realtime:** suscripcion a cambios de `votos` para refrescar resultados.

## Modelo de datos

- `users`: perfil de usuarios autenticados y rol administrativo.
- `elecciones`: nombre, ventana de votacion y estado.
- `cargos`: puestos configurables, orden y limite de candidatos activos.
- `candidatos`: participantes por eleccion y cargo, con foto en Storage.
- `votantes`: registro auditado del votante con identidad hasheada.
- `votos`: seleccion por votante y cargo.
- `audit_logs`: acciones administrativas y eventos de voto.

## Flujo de voto

1. El votante ingresa nombre e identidad.
2. `/api/voting/validate` llama `has_voted` para revisar duplicidad.
3. El usuario selecciona un candidato por cargo.
4. `/api/voting/cast` llama `cast_vote`.
5. `cast_vote` valida eleccion activa, formato de identidad, candidatos activos, seleccion completa y unicidad.
6. La funcion inserta votante, votos y auditoria en una transaccion atomica.

## Seguridad aplicada

- Identidad del votante almacenada como SHA-256, mas una mascara visible.
- Restriccion unica por `eleccion_id + identidad_hash`.
- Restriccion unica por `votante_id + cargo_id`.
- RLS para impedir CRUD publico.
- Storage protegido para escrituras solo de admin.
- Validaciones Zod en cliente y servidor.
- Middleware para rutas administrativas.

## UI

- Componentes base estilo ShadCN UI en `src/components/ui`.
- Dark mode con `next-themes`.
- Toasts con `sonner`.
- Graficas con `recharts`.
- Exportaciones con `jspdf`, `jspdf-autotable` y `xlsx`.
