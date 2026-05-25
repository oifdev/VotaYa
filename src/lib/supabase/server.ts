import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { requireSupabaseBrowserEnv } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export async function createSupabaseServerClient() {
  const { supabaseUrl, supabaseAnonKey } = requireSupabaseBrowserEnv();
  const cookieStore = await cookies();

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
          // En rutas de solo lectura (Server Components) esto puede fallar,
          // es seguro ignorarlo porque el middleware ya maneja el refresco.
        }
      },
    },
  });

  return supabase;
}