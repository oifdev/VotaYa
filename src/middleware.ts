// Edge middleware for Supabase session refresh – works on Vercel
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { requireSupabaseBrowserEnv } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

/**
 * This middleware runs on the Edge runtime (default for Next.js middleware).
 * It reads the Supabase auth cookie from the request, forces a session refresh,
 * and forwards any updated cookies back to the client. This ensures the
 * `sb-…-auth-token` cookie stays fresh across all navigation, both locally
 * and in Vercel deployments.
 */
export const runtime = "experimental-edge";


export async function middleware(request: NextRequest) {
  const { supabaseUrl, supabaseAnonKey } = requireSupabaseBrowserEnv();

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  await supabase.auth.getUser();

  // Debug header – can be inspected in production
  supabaseResponse.headers.set("x-middleware-debug", "true");
  
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
    "/api/:path*",
  ],
};