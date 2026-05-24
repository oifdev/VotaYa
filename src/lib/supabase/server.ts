import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { requireSupabaseBrowserEnv } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export async function createSupabaseServerClient() {
  const { supabaseUrl, supabaseAnonKey } = requireSupabaseBrowserEnv();
  const cookieStore = await cookies();

  // DEBUG PARA NETLIFY:
  console.log("=== API ROUTE DEBUG ===");
  console.log("ALL COOKIES:", cookieStore.getAll().map(c => c.name));

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server components cannot always write cookies; middleware refreshes them.
        }
      },
    },
  });

  return supabase;
}
