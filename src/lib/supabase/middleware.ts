import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import {
  hasSupabaseBrowserEnv,
  supabaseAnonKey,
  supabaseUrl,
} from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  // IMPORTANT: Do NOT create separate redirect/error responses.
  // Always return supabaseResponse so refreshed cookies are preserved.
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

  // This call refreshes the session token if needed.
  // The refreshed cookies are saved in supabaseResponse via setAll above.
  // We intentionally do NOT redirect here — the layout handles auth redirects.
  // If we returned a different response (redirect/json), the refreshed
  // cookies would be lost and the session would break on next navigation.
  await supabase.auth.getUser();

  return supabaseResponse;
}