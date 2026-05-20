import { badRequest, ok, serverError } from "@/lib/api-response";
import { getRequestIp } from "@/lib/audit";
import { createPublicDataClient } from "@/lib/supabase/public-data";
import { identitySchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const eleccionId = String(body.eleccion_id || "");
    const identidad = identitySchema.parse(body.identidad);

    if (!eleccionId) {
      return badRequest("No hay una eleccion activa para validar.");
    }

    const supabase = await createPublicDataClient();
    const { data, error } = await supabase.rpc("has_voted", {
      p_eleccion_id: eleccionId,
      p_identidad: identidad,
    });

    if (error) return badRequest(error.message);

    return ok({
      alreadyVoted: Boolean(data),
      ip: getRequestIp(request),
    });
  } catch (error) {
    return serverError(error);
  }
}
