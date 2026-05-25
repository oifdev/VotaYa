"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Keeps server components fresh after client-side auth changes.
 * Cookie persistence is handled by @supabase/ssr and middleware.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        router.refresh();
      }

      if (event === "SIGNED_OUT") {
        window.location.href = "/login";
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return <>{children}</>;
}
