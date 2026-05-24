export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getRequestIp, writeAuditLog } from "@/lib/audit";
import { requireAdminApi } from "@/lib/auth";
import { badRequest, ok, sanitizeNullable, serverError } from "@/lib/api-response";
import { electionSchema } from "@/lib/validators";

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const { data, error } = await admin.supabase
    .from("elecciones")
    .select("*")
    .order("fecha_inicio", { ascending: false });

  if (error) return serverError(error);

  return ok({ elecciones: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  try {
    const body = await request.json();
    const payload = electionSchema.parse({
      ...body,
      descripcion: sanitizeNullable(body.descripcion),
    });

    const { data, error } = await admin.supabase
      .from("elecciones")
      .insert({
        ...payload,
        organizer_id: admin.user.id,
      })
      .select("*")
      .single();

    if (error) return badRequest(error.message);

    await writeAuditLog(admin.supabase, {
      actorId: admin.user.id,
      action: "eleccion.created",
      entityType: "eleccion",
      entityId: data.id,
      metadata: { nombre: data.nombre, estado: data.estado },
      ipAddress: getRequestIp(request),
    });

    return NextResponse.json({ eleccion: data }, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
