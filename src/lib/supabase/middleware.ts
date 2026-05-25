import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import {
  hasSupabaseBrowserEnv,
  supabaseAnonKey,
  supabaseUrl,
} from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  // Construimos la respuesta base que luego puede mutar con cookies refrescadas
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
        // 1. Actualizar el request para que las rutas siguientes lean las cookies nuevas
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        // 2. Reconstruir la respuesta con el request actualizado
        supabaseResponse = NextResponse.next({ request });
        // 3. Adjuntar las cookies a la respuesta para que el navegador las guarde
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANTE: usar getUser() y NO getSession().
  // getSession() lee solo de la cookie local sin validar contra Supabase Auth.
  // getUser() hace una llamada al servidor de Supabase y valida el JWT real.
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // MUY IMPORTANTE: devolver supabaseResponse (no crear un NextResponse nuevo aquí).
  // Si se devuelve un response diferente, se pierden las cookies que Supabase
  // pudo haber refrescado arriba, rompiendo la sesión en la siguiente request.
  return supabaseResponse;
}