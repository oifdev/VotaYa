"use client";

import { createBrowserClient } from "@supabase/ssr";

import {
  hasSupabaseBrowserEnv,
  requireSupabaseBrowserEnv,
} from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export function createSupabaseBrowserClient() {
  const { supabaseUrl, supabaseAnonKey } = requireSupabaseBrowserEnv();

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

export { hasSupabaseBrowserEnv };
