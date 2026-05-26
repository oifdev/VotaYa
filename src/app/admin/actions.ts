"use server";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { getAdminSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  emptyResults,
  getResultsPayload,
  resultsToDashboardStats,
} from "@/lib/elections";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type {
  AuditLog,
  Candidato,
  Cargo,
  Database,
  Eleccion,
} from "@/types/database";
import type {
  CandidateWithRelations,
  DashboardStats,
  ResultsPayload,
} from "@/types/domain";

type ActionResult<T> = { data: T; error?: never } | { data?: never; error: string };
type AdminClient = {
  supabase: SupabaseClient<Database>;
  user: User;
};

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

export async function getDashboardStatsAction(): Promise<
  ActionResult<{ stats: DashboardStats; results: ResultsPayload }>
> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  try {
    const electionId = await getLatestOwnedElectionId(supabase, user.id);
    const results = electionId
      ? await getResultsPayload(supabase, electionId)
      : emptyResults();

    return { data: { stats: resultsToDashboardStats(results), results } };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Error al cargar estadisticas.",
    };
  }
}

export async function getAuditLogsAction(): Promise<ActionResult<{ logs: AuditLog[] }>> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("actor_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return { error: error.message };
  return { data: { logs: (data ?? []) as AuditLog[] } };
}

export async function getEleccionesAction(): Promise<
  ActionResult<{ elecciones: Eleccion[] }>
> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  const { data, error } = await supabase
    .from("elecciones")
    .select("*")
    .eq("organizer_id", user.id)
    .order("fecha_inicio", { ascending: false });

  if (error) return { error: error.message };
  return { data: { elecciones: (data ?? []) as Eleccion[] } };
}

export async function getCargosAction(): Promise<ActionResult<{ cargos: Cargo[] }>> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  const electionIds = await getOwnedElectionIds(supabase, user.id);
  if (!electionIds.length) return { data: { cargos: [] } };

  const { data, error } = await supabase
    .from("cargos")
    .select("*")
    .in("eleccion_id", electionIds)
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) return { error: error.message };
  return { data: { cargos: (data ?? []) as Cargo[] } };
}

export async function getCandidatosAction(): Promise<
  ActionResult<{ candidatos: CandidateWithRelations[] }>
> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  const electionIds = await getOwnedElectionIds(supabase, user.id);
  if (!electionIds.length) return { data: { candidatos: [] } };

  const { data, error } = await supabase
    .from("candidatos")
    .select("*, eleccion:elecciones(id,nombre,estado)")
    .in("eleccion_id", electionIds)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { data: { candidatos: (data ?? []) as CandidateWithRelations[] } };
}

export async function createEleccionAction(payload: {
  nombre: string;
  descripcion?: string | null;
  fecha_inicio: string;
  fecha_cierre: string;
  estado: string;
}): Promise<ActionResult<{ eleccion: Eleccion }>> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  const insertPayload: Database["public"]["Tables"]["elecciones"]["Insert"] = {
    ...payload,
    estado: payload.estado as Database["public"]["Enums"]["election_status"],
    organizer_id: user.id,
  };

  const { data, error } = await supabase
    .from("elecciones")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) return { error: error.message };
  await writeAuditLog(supabase, {
    actorId: user.id,
    action: "eleccion.created",
    entityType: "eleccion",
    entityId: data.id,
    metadata: { nombre: data.nombre, estado: data.estado },
  });
  return { data: { eleccion: data as Eleccion } };
}

export async function updateEleccionAction(
  id: string,
  payload: Record<string, unknown>,
): Promise<ActionResult<{ eleccion: Eleccion }>> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  const { data, error } = await supabase
    .from("elecciones")
    .update(payload as Database["public"]["Tables"]["elecciones"]["Update"])
    .eq("id", id)
    .eq("organizer_id", user.id)
    .select("*")
    .single();

  if (error) return { error: error.message };
  await writeAuditLog(supabase, {
    actorId: user.id,
    action: "eleccion.updated",
    entityType: "eleccion",
    entityId: data.id,
    metadata: { nombre: data.nombre, estado: data.estado },
  });
  return { data: { eleccion: data as Eleccion } };
}

export async function deleteEleccionAction(
  id: string,
): Promise<ActionResult<{ success: boolean }>> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  const { data: election } = await supabase
    .from("elecciones")
    .select("nombre,estado")
    .eq("id", id)
    .eq("organizer_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("elecciones")
    .delete()
    .eq("id", id)
    .eq("organizer_id", user.id);

  if (error) return { error: error.message };
  await writeAuditLog(supabase, {
    actorId: user.id,
    action: "eleccion.deleted",
    entityType: "eleccion",
    entityId: id,
    metadata: election,
  });
  return { data: { success: true } };
}

export async function createCargoAction(
  payload: Record<string, unknown>,
): Promise<ActionResult<{ cargo: Cargo }>> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  const eleccionId = String(payload.eleccion_id ?? "");
  const isOwner = await ownsElection(supabase, user.id, eleccionId);

  if (!isOwner) return { error: "La eleccion seleccionada no pertenece a su cuenta." };

  const { data, error } = await supabase
    .from("cargos")
    .insert(payload as Database["public"]["Tables"]["cargos"]["Insert"])
    .select("*")
    .single();

  if (error) return { error: error.message };
  await writeAuditLog(supabase, {
    actorId: user.id,
    action: "cargo.created",
    entityType: "cargo",
    entityId: data.id,
    metadata: { nombre: data.nombre, eleccion_id: data.eleccion_id },
  });
  return { data: { cargo: data as Cargo } };
}

export async function updateCargoAction(
  id: string,
  payload: Record<string, unknown>,
): Promise<ActionResult<{ cargo: Cargo }>> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  const ownership = await getCargoOwnership(supabase, id);
  if (!ownership || ownership.organizer_id !== user.id) {
    return { error: "No tiene permisos para modificar este cargo." };
  }

  const { data, error } = await supabase
    .from("cargos")
    .update(payload as Database["public"]["Tables"]["cargos"]["Update"])
    .eq("id", id)
    .select("*")
    .single();

  if (error) return { error: error.message };
  await writeAuditLog(supabase, {
    actorId: user.id,
    action: "cargo.updated",
    entityType: "cargo",
    entityId: data.id,
    metadata: { nombre: data.nombre, eleccion_id: data.eleccion_id },
  });
  return { data: { cargo: data as Cargo } };
}

export async function deleteCargoAction(
  id: string,
): Promise<ActionResult<{ success: boolean }>> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  const ownership = await getCargoOwnership(supabase, id);
  if (!ownership || ownership.organizer_id !== user.id) {
    return { error: "No tiene permisos para eliminar este cargo." };
  }

  const { data: cargo } = await supabase
    .from("cargos")
    .select("nombre,eleccion_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("cargos").delete().eq("id", id);
  if (error) return { error: error.message };
  await writeAuditLog(supabase, {
    actorId: user.id,
    action: "cargo.deleted",
    entityType: "cargo",
    entityId: id,
    metadata: cargo,
  });
  return { data: { success: true } };
}

export async function createCandidatoAction(
  payload: Record<string, unknown>,
): Promise<ActionResult<{ candidato: Candidato }>> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  const eleccionId = String(payload.eleccion_id ?? "");
  const isOwner = await ownsElection(supabase, user.id, eleccionId);

  if (!isOwner) return { error: "La eleccion seleccionada no pertenece a su cuenta." };

  const { data, error } = await supabase
    .from("candidatos")
    .insert(payload as Database["public"]["Tables"]["candidatos"]["Insert"])
    .select("*")
    .single();

  if (error) return { error: error.message };
  await writeAuditLog(supabase, {
    actorId: user.id,
    action: "candidato.created",
    entityType: "candidato",
    entityId: data.id,
    metadata: {
      nombre_completo: data.nombre_completo,
      eleccion_id: data.eleccion_id,
    },
  });
  return { data: { candidato: data as Candidato } };
}

export async function updateCandidatoAction(
  id: string,
  payload: Record<string, unknown>,
): Promise<ActionResult<{ candidato: Candidato }>> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  const ownership = await getCandidateOwnership(supabase, id);
  if (!ownership || ownership.organizer_id !== user.id) {
    return { error: "No tiene permisos para modificar este candidato." };
  }

  const { data, error } = await supabase
    .from("candidatos")
    .update(payload as Database["public"]["Tables"]["candidatos"]["Update"])
    .eq("id", id)
    .select("*")
    .single();

  if (error) return { error: error.message };
  await writeAuditLog(supabase, {
    actorId: user.id,
    action: "candidato.updated",
    entityType: "candidato",
    entityId: data.id,
    metadata: {
      nombre_completo: data.nombre_completo,
      eleccion_id: data.eleccion_id,
    },
  });
  return { data: { candidato: data as Candidato } };
}

export async function deleteCandidatoAction(
  id: string,
): Promise<ActionResult<{ success: boolean }>> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  const ownership = await getCandidateOwnership(supabase, id);
  if (!ownership || ownership.organizer_id !== user.id) {
    return { error: "No tiene permisos para eliminar este candidato." };
  }

  const { data: candidate } = await supabase
    .from("candidatos")
    .select("nombre_completo,eleccion_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("candidatos")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  await writeAuditLog(supabase, {
    actorId: user.id,
    action: "candidato.deleted",
    entityType: "candidato",
    entityId: id,
    metadata: candidate,
  });
  return { data: { success: true } };
}

async function getOwnedElectionIds(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("elecciones")
    .select("id")
    .eq("organizer_id", userId);

  if (error) throw error;
  return (data ?? []).map((item) => item.id);
}

async function getLatestOwnedElectionId(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("elecciones")
    .select("id")
    .eq("organizer_id", userId)
    .order("fecha_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
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

async function getCargoOwnership(supabase: SupabaseClient<Database>, cargoId: string) {
  const { data, error } = await supabase
    .from("cargos")
    .select("eleccion:elecciones(organizer_id)")
    .eq("id", cargoId)
    .maybeSingle();

  if (error) throw error;
  return data?.eleccion as { organizer_id: string } | null | undefined;
}

async function getCandidateOwnership(
  supabase: SupabaseClient<Database>,
  candidateId: string,
) {
  const { data, error } = await supabase
    .from("candidatos")
    .select("eleccion:elecciones(organizer_id)")
    .eq("id", candidateId)
    .maybeSingle();

  if (error) throw error;
  return data?.eleccion as { organizer_id: string } | null | undefined;
}
