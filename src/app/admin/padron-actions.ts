"use server";

import { createHash } from "node:crypto";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { writeAuditLog } from "@/lib/audit";
import { getAdminSession } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { padronVotanteSchema } from "@/lib/validators";
import type { Database, PadronVotante, RecordStatus } from "@/types/database";

type ActionResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

type AdminClient = {
  supabase: SupabaseClient<Database>;
  user: User;
};

function cleanIdentity(value: string) {
  return value.replace(/\D/g, "");
}

function hashIdentity(cleaned: string) {
  return createHash("sha256").update(cleaned).digest("hex");
}

function maskIdentity(cleaned: string) {
  return `****-****-${cleaned.slice(-5)}`;
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

async function getAdminSupabase(): Promise<ActionResult<AdminClient>> {
  const session = await getAdminSession();

  if (!session.user) {
    return { error: "No autorizado. Inicie sesion nuevamente." };
  }

  if (session.profile?.role !== "admin") {
    return { error: "No autorizado. Su usuario no tiene rol administrador." };
  }

  try {
    // The session proves who is acting; service role performs the mutation server-side.
    return {
      data: {
        supabase: createSupabaseServiceClient(),
        user: session.user,
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo crear el cliente administrativo de Supabase.",
    };
  }
}

async function ownsElection(
  supabase: SupabaseClient<Database>,
  userId: string,
  electionId: string,
) {
  if (!electionId) return false;

  const { data, error } = await supabase
    .from("elecciones")
    .select("id")
    .eq("id", electionId)
    .eq("organizer_id", userId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function getPadronOwnership(
  supabase: SupabaseClient<Database>,
  padronId: string,
) {
  const { data, error } = await supabase
    .from("padron_votantes")
    .select("id,eleccion_id")
    .eq("id", padronId)
    .maybeSingle();

  if (error) throw error;
  return data as Pick<PadronVotante, "id" | "eleccion_id"> | null;
}

export async function getPadronAction(
  eleccionId: string,
): Promise<ActionResult<{ padron: PadronVotante[] }>> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  try {
    const isOwner = await ownsElection(supabase, user.id, eleccionId);
    if (!isOwner) {
      return { error: "La eleccion seleccionada no pertenece a su cuenta." };
    }

    const { data, error } = await supabase
      .from("padron_votantes")
      .select("*")
      .eq("eleccion_id", eleccionId)
      .order("created_at", { ascending: false });

    if (error) return { error: error.message };
    return { data: { padron: (data ?? []) as PadronVotante[] } };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "No se pudo cargar el padron.",
    };
  }
}

export async function createPadronEntryAction(
  payload: unknown,
): Promise<ActionResult<{ entry: PadronVotante }>> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  try {
    const parsed = padronVotanteSchema.parse(payload);

    const isOwner = await ownsElection(supabase, user.id, parsed.eleccion_id);
    if (!isOwner) {
      return { error: "La eleccion seleccionada no pertenece a su cuenta." };
    }

    const cleaned = cleanIdentity(parsed.identidad);
    const identidad_hash = hashIdentity(cleaned);
    const identidad_masked = maskIdentity(cleaned);

    const { data, error } = await supabase
      .from("padron_votantes")
      .insert({
        eleccion_id: parsed.eleccion_id,
        nombre_completo: normalizeName(parsed.nombre_completo),
        identidad_hash,
        identidad_masked,
        estado: parsed.estado as RecordStatus,
      })
      .select("*")
      .single();

    if (error) return { error: error.message };

    await writeAuditLog(supabase, {
      actorId: user.id,
      action: "padron.created",
      entityType: "padron_votante",
      entityId: data.id,
      metadata: {
        eleccion_id: data.eleccion_id,
        identidad_masked: data.identidad_masked,
      },
    });

    return { data: { entry: data as PadronVotante } };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "No se pudo registrar el votante.",
    };
  }
}

export async function setPadronEntryStatusAction(
  id: string,
  estado: RecordStatus,
): Promise<ActionResult<{ entry: PadronVotante }>> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  try {
    const ownership = await getPadronOwnership(supabase, id);
    if (!ownership) return { error: "Registro no encontrado." };

    const isOwner = await ownsElection(supabase, user.id, ownership.eleccion_id);
    if (!isOwner) return { error: "No tiene permisos para modificar este registro." };

    const { data, error } = await supabase
      .from("padron_votantes")
      .update({ estado })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return { error: error.message };

    await writeAuditLog(supabase, {
      actorId: user.id,
      action: "padron.status_updated",
      entityType: "padron_votante",
      entityId: id,
      metadata: { estado },
    });

    return { data: { entry: data as PadronVotante } };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "No se pudo actualizar el estado.",
    };
  }
}

export async function deletePadronEntryAction(
  id: string,
): Promise<ActionResult<{ success: boolean }>> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  try {
    const ownership = await getPadronOwnership(supabase, id);
    if (!ownership) return { error: "Registro no encontrado." };

    const isOwner = await ownsElection(supabase, user.id, ownership.eleccion_id);
    if (!isOwner) return { error: "No tiene permisos para eliminar este registro." };

    const { data: entry } = await supabase
      .from("padron_votantes")
      .select("identidad_masked,eleccion_id")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase.from("padron_votantes").delete().eq("id", id);
    if (error) return { error: error.message };

    await writeAuditLog(supabase, {
      actorId: user.id,
      action: "padron.deleted",
      entityType: "padron_votante",
      entityId: id,
      metadata: entry ?? null,
    });

    return { data: { success: true } };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "No se pudo eliminar el registro.",
    };
  }
}

