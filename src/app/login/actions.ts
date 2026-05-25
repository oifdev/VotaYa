"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function loginAction(values: { email: string; password: string }) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(values);

  if (error) {
    return { error: error.message };
  }

  // Refrescar layouts para limpiar estado de navegacion
  revalidatePath("/", "layout");
  return { success: true };
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return { success: true };
}
