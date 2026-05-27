import { type NextRequest } from "next/server";

import { ok, serverError } from "@/lib/api-response";
import { emptyResults, getResultsPayload } from "@/lib/elections";
import { hasSupabaseBrowserEnv } from "@/lib/supabase/config";
import { createPublicDataClient } from "@/lib/supabase/public-data";

type WinnerItem = {
  cargo_id: string;
  cargo_nombre: string;
  ganador: null | {
    candidato_id: string;
    nombre_completo: string;
    foto_url: string | null;
    votos: number;
    porcentaje: number;
  };
};

export async function GET(request: NextRequest) {
  try {
    if (!hasSupabaseBrowserEnv()) {
      return ok(
        { election: null, winners: [] as WinnerItem[], updatedAt: new Date().toISOString() },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const electionId = request.nextUrl.searchParams.get("electionId");
    const supabase = await createPublicDataClient();
    const results = await getResultsPayload(supabase, electionId);

    if (!results.election) {
      const empty = emptyResults();
      return ok(
        { election: empty.election, winners: [] as WinnerItem[], updatedAt: empty.updatedAt },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const winners: WinnerItem[] = results.cargos.map((cargo) => {
      const winner = cargo.candidatos.find((candidate) => candidate.isWinner) ?? null;

      return {
        cargo_id: cargo.cargo_id,
        cargo_nombre: cargo.cargo_nombre,
        ganador: winner
          ? {
              candidato_id: winner.candidato_id,
              nombre_completo: winner.nombre_completo,
              foto_url: winner.foto_url,
              votos: winner.votos,
              porcentaje: winner.porcentaje,
            }
          : null,
      };
    });

    return ok(
      { election: results.election, winners, updatedAt: results.updatedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return serverError(error);
  }
}

