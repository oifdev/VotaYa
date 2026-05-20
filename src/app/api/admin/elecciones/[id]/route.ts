import { getRequestIp, writeAuditLog } from "@/lib/audit";
import { requireAdminApi } from "@/lib/auth";
import { badRequest, ok, sanitizeNullable, serverError } from "@/lib/api-response";
import { electionUpdateSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const normalized = { ...body };
    if ("descripcion" in normalized) {
      normalized.descripcion = sanitizeNullable(normalized.descripcion);
    }
    const payload = electionUpdateSchema.parse(normalized);

    const { data, error } = await admin.supabase
      .from("elecciones")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return badRequest(error.message);

    await writeAuditLog(admin.supabase, {
      actorId: admin.user.id,
      action: "eleccion.updated",
      entityType: "eleccion",
      entityId: id,
      metadata: payload,
      ipAddress: getRequestIp(request),
    });

    return ok({ eleccion: data });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const { id } = await context.params;
  const { error } = await admin.supabase.from("elecciones").delete().eq("id", id);

  if (error) return badRequest(error.message);

  await writeAuditLog(admin.supabase, {
    actorId: admin.user.id,
    action: "eleccion.deleted",
    entityType: "eleccion",
    entityId: id,
    ipAddress: getRequestIp(request),
  });

  return ok({ deleted: true });
}
