import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { AdminUser } from '@/types/database';

export async function getAdminSession() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, profile: null, error };
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
  const session = await getAdminSession();
  if (!session.user || session.profile?.role !== "admin") {
    return null;
  }
  return session;
}

export async function requireAdminApi() {
  const session = await getAdminSession();

  if (!session.user || session.profile?.role !== "admin") {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll().map(c => c.name).join(", ");
    
    return {
      ok: false as const,
      response: NextResponse.json(
        { 
          message: `No autorizado. Error Auth: ${session.error?.message || 'Ninguno'}. Cookies detectadas: ${allCookies || 'Ninguna'}` 
        },
        { status: 401 },
      ),
    };
  }

  return {
    ok: true as const,
    ...session,
  };
}
