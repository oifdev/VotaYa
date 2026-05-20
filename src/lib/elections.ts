import type { SupabaseClient } from "@supabase/supabase-js";

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

  return { election, cargos: cargos ?? [], candidatos: candidatos ?? [] };
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
  const candidateRows = candidatos ?? [];
  const cargoRows = cargos ?? [];

  const cargosPayload = cargoRows
    .map((cargo) => {
      const total = voteRows.filter((vote) => vote.cargo_id === cargo.id).length;
      const maxVotes = Math.max(
        0,
        ...candidateRows.map(
          (candidate) =>
            voteRows.filter((vote) => vote.cargo_id === cargo.id && vote.candidato_id === candidate.id).length,
        ),
      );

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
            isWinner: total > 0 && votes === maxVotes && votes > 0,
          };
        }),
      };
    })
    .filter((cargo) => cargo.candidatos.length > 0);

  const totalVotes = voteRows.length;
  const participation =
    cargosPayload.length > 0 && voterCount
      ? (totalVotes / (voterCount * cargosPayload.length)) * 100
      : 0;

  return {
    election,
    totals: {
      votantes: voterCount ?? 0,
      votos: totalVotes,
      cargos: cargosPayload.length,
      candidatos: candidateRows.length,
      participacionPromedio: participation,
    },
    cargos: cargosPayload,
    updatedAt: new Date().toISOString(),
  };
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
