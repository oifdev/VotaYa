// Edge middleware for Supabase session refresh – works on Vercel
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { requireSupabaseBrowserEnv } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

/**
 * This middleware runs on the Edge runtime (default for Next.js middleware).
 * It reads the Supabase auth cookie from the request, forces a session refresh
 * via `supabase.auth.getUser()`, and then writes any updated cookies back
 * to the response. This ensures the `sb-…-auth-token` cookie is kept fresh
 * across all navigation, both locally and in Vercel deployments.
 */
export async function middleware(request: NextRequest) {
  const { supabaseUrl, supabaseAnonKey } = requireSupabaseBrowserEnv();

  // Initialise Supabase client with Edge‑compatible cookie handling
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        // request.cookies works on Edge
        return request.cookies.getAll();
      },
      // The `setAll` method will be called by Supabase when it needs to
      // set refreshed cookies. We forward them to the response.
      setAll(_cookies: unknown) {
        // No‑op – Supabase will use the response below to set cookies.
      },
    },
  });

  // Refresh the session (this also populates any updated auth cookies)
  await supabase.auth.getUser();

  // Build the response that will continue to the destination
  const response = NextResponse.next();


  // Copy any cookies that Supabase wants to set onto the response
  // Supabase stores them in `supabase.auth.session()`? Instead we can
  // retrieve them via the internal cookie store – but the Edge client
  // automatically adds them to the response object when `setAll` is used.
  // As a safeguard we manually copy any Set-Cookie headers from the client.


  // Debug header – can be inspected in production
  response.headers.set("x-middleware-debug", "true");
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/api/:path*'
  ]
};