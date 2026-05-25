import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import {
  hasSupabaseBrowserEnv,
  supabaseAnonKey,
  supabaseUrl,
} from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!hasSupabaseBrowserEnv() || !supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  const isApiRoute = request.nextUrl.pathname.startsWith("/api/admin");
  const isAdminPage = request.nextUrl.pathname.startsWith("/admin");

  if (!user) {
    if (isApiRoute) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }
    if (isAdminPage) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return supabaseResponse;
}