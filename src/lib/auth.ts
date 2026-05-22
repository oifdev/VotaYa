import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

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
  if (!session.user) {
    return null;
  }
  return session;
}
export async function requireAdminApi(request: Request) {
  const session = await getAdminSession(request);

  if (!session.user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { message: `No autorizado. Inicie sesion para continuar. Detalle: ${session.error?.message || 'Ninguno'}` },
        { status: 401 },
      ),
    };
  }

  return {
    ok: true as const,
    ...session,
  };
}
