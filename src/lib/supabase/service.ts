import { createClient } from "@supabase/supabase-js";

import { requireSupabaseServiceEnv } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export function createSupabaseServiceClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = requireSupabaseServiceEnv();

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
