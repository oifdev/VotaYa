import type { SupabaseClient } from "@supabase/supabase-js";

import { compareByBallotNumber } from "@/lib/utils";
import type { Candidato, Cargo, Database, Eleccion } from "@/types/database";
import type { DashboardStats, ResultsPayload } from "@/types/domain";

type Client = SupabaseClient<Database>;

export async function getCurrentElection(supabase: Client) {
  const now = new Date().toISOString();

  const { data: active, error: activeError } = await supabase
    .from("elecciones")
    .select("*")
    .eq("estado", "activa")
    .lte("fecha_inicio", now)
    .gte("fecha_cierre", now)
    .order("fecha_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeError) throw activeError;
  if (active) return active;

  const { data, error } = await supabase
    .from("elecciones")
    .select("*")
    .order("fecha_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getVotingContext(supabase: Client) {
  const election = await getCurrentElection(supabase);

  if (!election || election.estado !== "activa") {
    return { election, cargos: [] as Cargo[], candidatos: [] as Candidato[] };
  }

  const [{ data: cargos, error: cargosError }, { data: candidatos, error: candidatosError }] =
    await Promise.all([
      supabase
        .from("cargos")
        .select("*")
        .eq("estado", "activo")
        .order("orden", { ascending: true })
        .order("nombre", { ascending: true }),
      supabase
        .from("candidatos")
        .select("*")
        .eq("eleccion_id", election.id)
        .eq("estado", "activo")
        .order("nombre_completo", { ascending: true }),
    ]);

  if (cargosError) throw cargosError;
  if (candidatosError) throw candidatosError;

  return {
    election,
    cargos: cargos ?? [],
    candidatos: (candidatos ?? []).slice().sort(compareByBallotNumber),
  };
}

export async function getResultsPayload(
  supabase: Client,
  electionId?: string | null,
): Promise<ResultsPayload> {
  const election = electionId
    ? await getElectionById(supabase, electionId)
    : await getCurrentElection(supabase);

  if (!election) {
    return emptyResults();
  }

  const [
    { data: cargos, error: cargosError },
    { data: candidatos, error: candidatosError },
    { data: votos, error: votosError },
    { count: voterCount, error: voterError },
  ] = await Promise.all([
    supabase
      .from("cargos")
      .select("*")
      .eq("eleccion_id", election.id)
      .eq("estado", "activo")
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true }),
    supabase
      .from("candidatos")
      .select("*")
      .eq("eleccion_id", election.id)
      .eq("estado", "activo")
      .order("nombre_completo", { ascending: true }),
    supabase
      .from("votos")
      .select("cargo_id,candidato_id")
      .eq("eleccion_id", election.id),
    supabase
      .from("votantes")
      .select("id", { count: "exact", head: true })
      .eq("eleccion_id", election.id),
  ]);

  if (cargosError) throw cargosError;
  if (candidatosError) throw candidatosError;
  if (votosError) throw votosError;
  if (voterError) throw voterError;

  const voteRows = votos ?? [];
  const candidateRows = (candidatos ?? []).slice().sort(compareByBallotNumber);
  const cargoRows = cargos ?? [];

  const cargosPayload = cargoRows
    .map((cargo) => {
      const total = voteRows.filter((vote) => vote.cargo_id === cargo.id).length;

      return {
        cargo_id: cargo.id,
        cargo_nombre: cargo.nombre,
        total_votos: total,
        candidatos: candidateRows.map((candidate) => {
          const votes = voteRows.filter(
            (vote) => vote.cargo_id === cargo.id && vote.candidato_id === candidate.id,
          ).length;

          return {
            candidato_id: candidate.id,
            nombre_completo: candidate.nombre_completo,
            foto_url: candidate.foto_url,
            cargo_id: cargo.id,
            cargo_nombre: cargo.nombre,
            votos: votes,
            porcentaje: total > 0 ? (votes / total) * 100 : 0,
            // Winner is computed after tallying all cargos to enforce exclusivity:
            // a candidate can win only one cargo, resolved by cargo priority (orden).
            isWinner: false,
          };
        }),
      };
    })
    .filter((cargo) => cargo.candidatos.length > 0);

  const cargosWithWinners = applyUniqueWinnerByCargoPriority(cargosPayload);
  const cargosOrdered = sortCargoCandidatesBySupport(cargosWithWinners);

  const totalVotes = voteRows.length;
  const participation =
    cargosOrdered.length > 0 && voterCount
      ? (totalVotes / (voterCount * cargosOrdered.length)) * 100
      : 0;

  return {
    election,
    totals: {
      votantes: voterCount ?? 0,
      votos: totalVotes,
      cargos: cargosOrdered.length,
      candidatos: candidateRows.length,
      participacionPromedio: participation,
    },
    cargos: cargosOrdered,
    updatedAt: new Date().toISOString(),
  };
}

function applyUniqueWinnerByCargoPriority(results: ResultsPayload["cargos"]) {
  // Rule: a candidate cannot win more than one cargo.
  // We assign cargos in priority order (already sorted by `cargos.orden` in the SQL query),
  // picking the highest-voted eligible candidate for each cargo.
  // Ties are broken by ballot order (the candidates list is already sorted by ballot number).
  const used = new Set<string>();

  return results.map((cargo) => {
    let winnerId: string | null = null;
    let maxVotes = 0;
    let winnerIndex = Number.POSITIVE_INFINITY;

    cargo.candidatos.forEach((candidate, index) => {
      if (used.has(candidate.candidato_id)) return;
      // If there are no votes for the cargo, we don't assign any winner.
      if (cargo.total_votos <= 0) return;

      if (candidate.votos > maxVotes) {
        maxVotes = candidate.votos;
        winnerId = candidate.candidato_id;
        winnerIndex = index;
        return;
      }

      if (candidate.votos === maxVotes && index < winnerIndex) {
        winnerId = candidate.candidato_id;
        winnerIndex = index;
      }
    });

    if (winnerId) used.add(winnerId);

    return {
      ...cargo,
      candidatos: cargo.candidatos.map((candidate) => ({
        ...candidate,
        isWinner: winnerId ? candidate.candidato_id === winnerId : false,
      })),
    };
  });
}

function sortCargoCandidatesBySupport(results: ResultsPayload["cargos"]) {
  // Presentation: order candidates by support within each cargo.
  // Tie-breaker preserves the original ordering (ballot order).
  return results.map((cargo) => {
    const withIndex = cargo.candidatos.map((candidate, index) => ({
      candidate,
      index,
    }));

    withIndex.sort((a, b) => {
      const diff = b.candidate.votos - a.candidate.votos;
      if (diff !== 0) return diff;
      return a.index - b.index;
    });

    return {
      ...cargo,
      candidatos: withIndex.map((item) => item.candidate),
    };
  });
}

export function resultsToDashboardStats(results: ResultsPayload): DashboardStats {
  return {
    totalVotantes: results.totals.votantes,
    totalVotos: results.totals.votos,
    totalCandidatos: results.totals.candidatos,
    totalCargos: results.totals.cargos,
    participacionPorCargo: results.cargos.map((cargo) => ({
      cargo: cargo.cargo_nombre,
      votos: cargo.total_votos,
    })),
    resultados: results.cargos.flatMap((cargo) => cargo.candidatos),
  };
}

async function getElectionById(supabase: Client, electionId: string) {
  const { data, error } = await supabase
    .from("elecciones")
    .select("*")
    .eq("id", electionId)
    .maybeSingle();

  if (error) throw error;
  return data as Eleccion | null;
}

export function emptyResults(): ResultsPayload {
  return {
    election: null,
    totals: {
      votantes: 0,
      votos: 0,
      cargos: 0,
      candidatos: 0,
      participacionPromedio: 0,
    },
    cargos: [],
    updatedAt: new Date().toISOString(),
  };
}
