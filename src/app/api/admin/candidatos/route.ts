export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";

import { getRequestIp, writeAuditLog } from "@/lib/audit";
import { requireAdminApi } from "@/lib/auth";
import { badRequest, ok, sanitizeNullable, serverError } from "@/lib/api-response";
import { candidateSchema } from "@/lib/validators";

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const { data, error } = await admin.supabase
    .from("candidatos")
    .select(
      "*, eleccion:elecciones(id,nombre,estado)",
    )
    .order("created_at", { ascending: false });

  if (error) return serverError(error);

  return ok({ candidatos: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  try {
    const body = await request.json();
    const payload = candidateSchema.parse({
      ...body,
      biografia: sanitizeNullable(body.biografia),
      foto_url: sanitizeNullable(body.foto_url),
    });

    const { data, error } = await admin.supabase
      .from("candidatos")
      .insert(payload)
      .select("*")
      .single();

    if (error) return badRequest(error.message);

    await writeAuditLog(admin.supabase, {
      actorId: admin.user.id,
      action: "candidato.created",
      entityType: "candidato",
      entityId: data.id,
      metadata: {
        nombre: data.nombre_completo,
        eleccion_id: data.eleccion_id,
      },
      ipAddress: getRequestIp(request),
    });

    return NextResponse.json({ candidato: data }, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
