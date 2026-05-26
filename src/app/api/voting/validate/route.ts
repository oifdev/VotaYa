import { badRequest, ok, serverError } from "@/lib/api-response";
import { getRequestIp } from "@/lib/audit";
import { supabaseServiceRoleKey } from "@/lib/supabase/config";
import { createPublicDataClient } from "@/lib/supabase/public-data";
import { identitySchema } from "@/lib/validators";

import { createHash } from "node:crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const eleccionId = String(body.eleccion_id || "");
    const identidad = identitySchema.parse(body.identidad);

    if (!eleccionId) {
      return badRequest("No hay una eleccion activa para validar.");
    }

    // This endpoint validates a public voter identity against the padron (registry).
    // We intentionally run the padron lookup with the service role so the padron table
    // can remain protected by RLS (not readable from the client).
    if (!supabaseServiceRoleKey) {
      return badRequest(
        "Configuracion incompleta del servidor: falta SUPABASE_SERVICE_ROLE_KEY. Reinicie el servidor y verifique las variables de entorno.",
      );
    }

    const supabase = await createPublicDataClient();
    const cleanedIdentity = identidad.replace(/\D/g, "");
    const identidadHash = createHash("sha256").update(cleanedIdentity).digest("hex");

    const { data: registro, error: registroError } = await supabase
      .from("padron_votantes")
      .select("nombre_completo, estado")
      .eq("eleccion_id", eleccionId)
      .eq("identidad_hash", identidadHash)
      .maybeSingle();

    if (registroError) return badRequest(registroError.message);
    if (!registro) {
      // Helpful diagnostics for common misconfigurations:
      // - Padron not loaded for the active election
      // - Padron loaded, but for a different election_id than the one being used in voting context
      const [{ count: padronCount }, { data: anyElectionRecord }, { data: election }] =
        await Promise.all([
          supabase
            .from("padron_votantes")
            .select("id", { count: "exact", head: true })
            .eq("eleccion_id", eleccionId),
          supabase
            .from("padron_votantes")
            .select("eleccion_id")
            .eq("identidad_hash", identidadHash)
            .limit(1)
            .maybeSingle(),
          supabase.from("elecciones").select("nombre").eq("id", eleccionId).maybeSingle(),
        ]);

      const electionName = election?.nombre ? `\"${election.nombre}\"` : "esta eleccion";

      if (anyElectionRecord?.eleccion_id) {
        return badRequest(
          `Identidad registrada, pero no para ${electionName}. Verifique que cargo el padron para la eleccion activa.`,
        );
      }

      if ((padronCount ?? 0) === 0) {
        return badRequest(
          `El padron esta vacio para ${electionName}. Cargue el padron (public.padron_votantes) para poder validar identidades.`,
        );
      }

      return badRequest("Identidad no registrada para esta eleccion.");
    }
    if (registro.estado !== "activo") {
      return badRequest("Esta identidad se encuentra inactiva para votar.");
    }

    const { data, error } = await supabase.rpc("has_voted", {
      p_eleccion_id: eleccionId,
      p_identidad: identidad,
    });

    if (error) return badRequest(error.message);

    return ok({
      alreadyVoted: Boolean(data),
      nombre_completo: registro.nombre_completo,
      ip: getRequestIp(request),
    });
  } catch (error) {
    return serverError(error);
  }
}
