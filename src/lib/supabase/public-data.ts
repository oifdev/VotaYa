import { supabaseServiceRoleKey } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function createPublicDataClient() {
  if (supabaseServiceRoleKey) {
    return createSupabaseServiceClient();
  }

  return createSupabaseServerClient();
}
