"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getResultsPayload, resultsToDashboardStats } from "@/lib/elections";
import type { AuditLog, Candidato, Cargo, Eleccion } from "@/types/database";
import type { DashboardStats, ResultsPayload, CandidateWithRelations } from "@/types/domain";

type ActionResult<T> = { data: T; error?: never } | { data?: never; error: string };

async function getAdminSupabase() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) {
    return { supabase: null, error: "No autorizado. Inicie sesion para continuar." };
  }
  return { supabase, user, error: null };
}

export async function getDashboardStatsAction(): Promise<ActionResult<{ stats: DashboardStats; results: ResultsPayload }>> {
  const admin = await getAdminSupabase();
  if (admin.error || !admin.supabase) return { error: admin.error ?? "No autorizado" };

  try {
    const results = await getResultsPayload(admin.supabase);
    return { data: { stats: resultsToDashboardStats(results), results } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al cargar estadisticas." };
  }
}

export async function getAuditLogsAction(): Promise<ActionResult<{ logs: AuditLog[] }>> {
  const admin = await getAdminSupabase();
  if (admin.error || !admin.supabase) return { error: admin.error ?? "No autorizado" };

  const { data, error } = await admin.supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return { error: error.message };
  return { data: { logs: (data ?? []) as AuditLog[] } };
}

export async function getEleccionesAction(): Promise<ActionResult<{ elecciones: Eleccion[] }>> {
  const admin = await getAdminSupabase();
  if (admin.error || !admin.supabase) return { error: admin.error ?? "No autorizado" };

  const { data, error } = await admin.supabase
    .from("elecciones")
    .select("*")
    .order("fecha_inicio", { ascending: false });

  if (error) return { error: error.message };
  return { data: { elecciones: (data ?? []) as Eleccion[] } };
}

export async function getCargosAction(): Promise<ActionResult<{ cargos: Cargo[] }>> {
  const admin = await getAdminSupabase();
  if (admin.error || !admin.supabase) return { error: admin.error ?? "No autorizado" };

  const { data, error } = await admin.supabase
    .from("cargos")
    .select("*")
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) return { error: error.message };
  return { data: { cargos: (data ?? []) as Cargo[] } };
}

export async function getCandidatosAction(): Promise<ActionResult<{ candidatos: CandidateWithRelations[] }>> {
  const admin = await getAdminSupabase();
  if (admin.error || !admin.supabase) return { error: admin.error ?? "No autorizado" };

  const { data, error } = await admin.supabase
    .from("candidatos")
    .select("*, eleccion:elecciones(id,nombre,estado)")
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
  if (admin.error || !admin.supabase) return { error: admin.error ?? "No autorizado" };

  const { data, error } = await admin.supabase
    .from("elecciones")
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ ...payload, organizer_id: admin.user!.id } as any)
    .select("*")
    .single();

  if (error) return { error: error.message };
  return { data: { eleccion: data as Eleccion } };
}

export async function updateEleccionAction(id: string, payload: Record<string, unknown>): Promise<ActionResult<{ eleccion: Eleccion }>> {
  const admin = await getAdminSupabase();
  if (admin.error || !admin.supabase) return { error: admin.error ?? "No autorizado" };

  const { data, error } = await admin.supabase
    .from("elecciones")
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(payload as any)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return { error: error.message };
  return { data: { eleccion: data as Eleccion } };
}

export async function deleteEleccionAction(id: string): Promise<ActionResult<{ success: boolean }>> {
  const admin = await getAdminSupabase();
  if (admin.error || !admin.supabase) return { error: admin.error ?? "No autorizado" };

  const { error } = await admin.supabase.from("elecciones").delete().eq("id", id);
  if (error) return { error: error.message };
  return { data: { success: true } };
}

export async function createCargoAction(payload: Record<string, unknown>): Promise<ActionResult<{ cargo: Cargo }>> {
  const admin = await getAdminSupabase();
  if (admin.error || !admin.supabase) return { error: admin.error ?? "No autorizado" };

  const { data, error } = await admin.supabase
    .from("cargos")
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(payload as any)
    .select("*")
    .single();

  if (error) return { error: error.message };
  return { data: { cargo: data as Cargo } };
}

export async function updateCargoAction(id: string, payload: Record<string, unknown>): Promise<ActionResult<{ cargo: Cargo }>> {
  const admin = await getAdminSupabase();
  if (admin.error || !admin.supabase) return { error: admin.error ?? "No autorizado" };

  const { data, error } = await admin.supabase
    .from("cargos")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(payload as any)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return { error: error.message };
  return { data: { cargo: data as Cargo } };
}

export async function deleteCargoAction(id: string): Promise<ActionResult<{ success: boolean }>> {
  const admin = await getAdminSupabase();
  if (admin.error || !admin.supabase) return { error: admin.error ?? "No autorizado" };

  const { error } = await admin.supabase.from("cargos").delete().eq("id", id);
  if (error) return { error: error.message };
  return { data: { success: true } };
}

export async function createCandidatoAction(payload: Record<string, unknown>): Promise<ActionResult<{ candidato: Candidato }>> {
  const admin = await getAdminSupabase();
  if (admin.error || !admin.supabase) return { error: admin.error ?? "No autorizado" };

  const { data, error } = await admin.supabase
    .from("candidatos")
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(payload as any)
    .select("*")
    .single();

  if (error) return { error: error.message };
  return { data: { candidato: data as Candidato } };
}

export async function updateCandidatoAction(id: string, payload: Record<string, unknown>): Promise<ActionResult<{ candidato: Candidato }>> {
  const admin = await getAdminSupabase();
  if (admin.error || !admin.supabase) return { error: admin.error ?? "No autorizado" };

  const { data, error } = await admin.supabase
    .from("candidatos")
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(payload as any)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return { error: error.message };
  return { data: { candidato: data as Candidato } };
}

export async function deleteCandidatoAction(id: string): Promise<ActionResult<{ success: boolean }>> {
  const admin = await getAdminSupabase();
  if (admin.error || !admin.supabase) return { error: admin.error ?? "No autorizado" };

  const { error } = await admin.supabase.from("candidatos").delete().eq("id", id);
  if (error) return { error: error.message };
  return { data: { success: true } };
}
