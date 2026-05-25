"use server";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { getAdminSession } from "@/lib/auth";
import { candidatePhotoBucket } from "@/lib/constants";
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

export async function uploadCandidatePhotoAction(
  formData: FormData,
): Promise<ActionResult<{ publicUrl: string }>> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Seleccione una fotografia valida." };
  }

  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return { error: "La fotografia debe ser PNG, JPG o WebP." };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: "La fotografia no debe superar 5 MB." };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
  const path = `${user.id}/candidates/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage
    .from(candidatePhotoBucket)
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

  if (error) return { error: error.message };

  const { data } = supabase.storage
    .from(candidatePhotoBucket)
    .getPublicUrl(path);

  return { data: { publicUrl: data.publicUrl } };
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
  return { data: { eleccion: data as Eleccion } };
}

export async function deleteEleccionAction(
  id: string,
): Promise<ActionResult<{ success: boolean }>> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  const { error } = await supabase
    .from("elecciones")
    .delete()
    .eq("id", id)
    .eq("organizer_id", user.id);

  if (error) return { error: error.message };
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

  const { error } = await supabase.from("cargos").delete().eq("id", id);
  if (error) return { error: error.message };
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

  const { error } = await supabase
    .from("candidatos")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
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
