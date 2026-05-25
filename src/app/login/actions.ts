"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function loginAction(values: { email: string; password: string }) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(values);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
