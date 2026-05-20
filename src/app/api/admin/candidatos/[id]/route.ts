import { getRequestIp, writeAuditLog } from "@/lib/audit";
import { requireAdminApi } from "@/lib/auth";
import { badRequest, ok, sanitizeNullable, serverError } from "@/lib/api-response";
import { candidateSchema } from "@/lib/validators";

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
    if ("biografia" in normalized) {
      normalized.biografia = sanitizeNullable(normalized.biografia);
    }
    if ("foto_url" in normalized) {
      normalized.foto_url = sanitizeNullable(normalized.foto_url);
    }
    const payload = candidateSchema.partial().parse(normalized);

    const { data, error } = await admin.supabase
      .from("candidatos")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return badRequest(error.message);

    await writeAuditLog(admin.supabase, {
      actorId: admin.user.id,
      action: "candidato.updated",
      entityType: "candidato",
      entityId: id,
      metadata: payload,
      ipAddress: getRequestIp(request),
    });

    return ok({ candidato: data });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const { id } = await context.params;
  const { error } = await admin.supabase
    .from("candidatos")
    .delete()
    .eq("id", id);

  if (error) return badRequest(error.message);

  await writeAuditLog(admin.supabase, {
    actorId: admin.user.id,
    action: "candidato.deleted",
    entityType: "candidato",
    entityId: id,
    ipAddress: getRequestIp(request),
  });

  return ok({ deleted: true });
}
