"use server";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { getAdminSession } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { Database, Votante } from "@/types/database";

type ActionResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

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

export async function getVotantesAction(
  eleccionId: string,
): Promise<ActionResult<{ votantes: Votante[] }>> {
  const admin = await getAdminSupabase();
  if (!admin.data) return { error: admin.error };
  const { supabase, user } = admin.data;

  try {
    const isOwner = await ownsElection(supabase, user.id, eleccionId);
    if (!isOwner) {
      return { error: "La eleccion seleccionada no pertenece a su cuenta." };
    }

    const { data, error } = await supabase
      .from("votantes")
      .select("*")
      .eq("eleccion_id", eleccionId)
      .order("created_at", { ascending: false });

    if (error) return { error: error.message };
    return { data: { votantes: (data ?? []) as Votante[] } };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "No se pudieron cargar los votantes.",
    };
  }
}

