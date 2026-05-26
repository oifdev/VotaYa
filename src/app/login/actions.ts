"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

export async function loginAction(
  values: { email: string; password: string },
  redirectTo = "/admin",
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(values);

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    await ensureUserProfile({
      id: data.user.id,
      email: data.user.email ?? values.email,
      fullName:
        typeof data.user.user_metadata?.full_name === "string"
          ? data.user.user_metadata.full_name
          : data.user.email ?? values.email,
    });
  }

  revalidatePath("/", "layout");
  return { success: true, redirectTo: safeRedirectPath(redirectTo) };
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return { success: true };
}

async function ensureUserProfile(input: {
  id: string;
  email: string;
  fullName: string;
}) {
  try {
    const service = createSupabaseServiceClient();
    await service.from("users").upsert(
      {
        id: input.id,
        email: input.email,
        full_name: input.fullName,
        role: "admin",
      },
      { onConflict: "id" },
    );
  } catch {
    // If the service key is not configured, login still succeeds. Admin actions
    // will surface the missing key clearly when they need privileged access.
  }
}

function safeRedirectPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/admin";
  }

  return value;
}
