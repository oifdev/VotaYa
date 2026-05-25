"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Escucha cambios de sesión del SDK del cliente y los sincroniza
 * hacia el servidor via /api/auth/session. Esto es necesario porque
 * el SDK del browser guarda la sesión en localStorage, pero el
 * middleware del servidor solo lee cookies. Sin este puente, el
 * servidor nunca sabe que el usuario inició sesión.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        // @supabase/ssr automatically handles cookie sync in the browser
        // we no longer need manual fetch to /api/auth/session
        if (event === "SIGNED_OUT") {
          window.location.href = "/login";
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}