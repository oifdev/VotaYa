export const runtime = 'nodejs';


import { getRequestIp, writeAuditLog } from "@/lib/audit";
import { requireAdminApi } from "@/lib/auth";
import { badRequest, ok, sanitizeNullable, serverError } from "@/lib/api-response";
import { cargoSchema } from "@/lib/validators";

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const { data, error } = await admin.supabase
    .from("cargos")
    .select("*")
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) return serverError(error);

  return ok({ cargos: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  try {
    const body = await request.json();
    const payload = cargoSchema.parse({
      ...body,
      descripcion: sanitizeNullable(body.descripcion),
    });

    const { data, error } = await admin.supabase
      .from("cargos")
      .insert(payload)
      .select("*")
      .single();

    if (error) return badRequest(error.message);

    await writeAuditLog(admin.supabase, {
      actorId: admin.user.id,
      action: "cargo.created",
      entityType: "cargo",
      entityId: data.id,
      metadata: { nombre: data.nombre },
      ipAddress: getRequestIp(request),
    });

    return NextResponse.json({ cargo: data }, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
