import { badRequest, ok, serverError } from "@/lib/api-response";
import { getRequestIp } from "@/lib/audit";
import { createPublicDataClient } from "@/lib/supabase/public-data";
import { castVoteSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = castVoteSchema.parse(body);
    const supabase = await createPublicDataClient();

    const { data, error } = await supabase.rpc("cast_vote", {
      p_eleccion_id: payload.eleccion_id,
      p_nombre_completo: payload.votante.nombre_completo,
      p_identidad: payload.votante.identidad,
      p_votes: payload.selections,
      p_ip_address: getRequestIp(request),
      p_user_agent: request.headers.get("user-agent"),
    });

    if (error) return badRequest(error.message);

    return ok({ votanteId: data, message: "Su voto ha sido registrado exitosamente." });
  } catch (error) {
    return serverError(error);
  }
}
