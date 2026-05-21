import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminUser } from "@/types/database";

export async function getAdminSession() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    profile: profile as AdminUser | null,
  };
}

export async function requireAdminPage() {
  try {
    const session = await getAdminSession();

    if (!session.user) {
      redirect("/login");
    }

    return session;
  } catch {
    redirect("/login?redirect=/admin");
  }
}

export async function requireAdminApi() {
  const session = await getAdminSession();

  if (!session.user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { message: "No autorizado. Inicie sesion para continuar." },
        { status: 401 },
      ),
    };
  }

  return {
    ok: true as const,
    ...session,
  };
}
