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
      async (event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          // Sincronizar sesión hacia el servidor para que el middleware
          // pueda leerla desde las cookies en el próximo request
          await fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              access_token: session?.access_token,
              refresh_token: session?.refresh_token,
            }),
          });
        }

        if (event === "SIGNED_OUT") {
          await fetch("/api/auth/session", { method: "DELETE" });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}