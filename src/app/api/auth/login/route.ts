import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { requireSupabaseBrowserEnv } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as { email: string; password: string };
    const { supabaseUrl, supabaseAnonKey } = requireSupabaseBrowserEnv();

    // Construimos la respuesta antes para poder adjuntarle las cookies
    const successResponse = NextResponse.json({ success: true });

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            successResponse.cookies.set(name, value, {
              ...options,
              // path "/" asegura que el middleware y todas las rutas lean la cookie
              path: "/",
              // sameSite lax permite que las cookies lleguen en navegaciones normales
              sameSite: "lax",
              // secure en producción (Netlify siempre es HTTPS)
              secure: process.env.NODE_ENV === "production",
            });
          });
        },
      },
    });

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return successResponse;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}