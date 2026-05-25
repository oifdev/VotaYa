"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { absoluteUrl } from "@/lib/utils";

export async function registerAction(values: {
  full_name: string;
  email: string;
  password: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      emailRedirectTo: absoluteUrl("/auth/callback?next=/admin"),
      data: {
        full_name: values.full_name,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    await ensureUserProfile({
      id: data.user.id,
      email: data.user.email ?? values.email,
      fullName: values.full_name,
    });
  }

  revalidatePath("/", "layout");

  if (data.session) {
    redirect("/admin");
  }

  return {
    success:
      "Cuenta creada. Revise su correo para confirmar la sesion antes de entrar.",
  };
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
    // The database trigger in schema1.sql should also create this row when
    // installed. This fallback keeps registration resilient when it is missing.
  }
}
