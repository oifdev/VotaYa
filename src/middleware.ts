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

  // Collect cookies that Supabase wants to set during the auth refresh
  const pendingCookies: { name: string; value: string; options?: Record<string, unknown> }[] = [];

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        // request.cookies works on Edge
        return request.cookies.getAll();
      },
      setAll(cookies) {
        // Supabase calls this to set refreshed cookies – we store them for later
        pendingCookies.push(...cookies);
      },
    },
  });

  // Refresh the session (populates any updated auth cookies)
  await supabase.auth.getUser();

  // Build the response that will continue to the destination
  const response = NextResponse.next();

  // Forward any cookies Supabase asked to set
  pendingCookies.forEach((c) => {
    const opts = c.options || {};
    const parts = [];
    parts.push(`${c.name}=${c.value}`);
    if (opts.path) parts.push(`Path=${opts.path}`);
    if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
    if (opts.httpOnly) parts.push(`HttpOnly`);
    if (opts.secure) parts.push(`Secure`);
    if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
    response.headers.append('Set-Cookie', parts.join('; '));
  });

  // Debug header – can be inspected in production
  response.headers.set("x-middleware-debug", "true");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
    "/api/:path*",
  ],
};