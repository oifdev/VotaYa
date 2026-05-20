import type { Candidato, Cargo, Eleccion } from "@/types/database";

export type CandidateWithRelations = Candidato & {
  eleccion?: Pick<Eleccion, "id" | "nombre" | "estado"> | null;
};

export type BallotCargo = Cargo & {
  candidatos: Candidato[];
};

export type VotingContext = {
  election: Eleccion | null;
  cargos: Cargo[];
  candidatos: Candidato[];
};

export type VoteSelection = {
  cargo_id: string;
  candidato_id: string;
};

export type CandidateResult = {
  candidato_id: string;
  nombre_completo: string;
  foto_url: string | null;
  cargo_id: string;
  cargo_nombre: string;
  votos: number;
  porcentaje: number;
  isWinner: boolean;
};

export type CargoResult = {
  cargo_id: string;
  cargo_nombre: string;
  total_votos: number;
  candidatos: CandidateResult[];
};

export type ResultsPayload = {
  election: Eleccion | null;
  totals: {
    votantes: number;
    votos: number;
    cargos: number;
    candidatos: number;
    participacionPromedio: number;
  };
  cargos: CargoResult[];
  updatedAt: string;
};

export type DashboardStats = {
  totalVotantes: number;
  totalVotos: number;
  totalCandidatos: number;
  totalCargos: number;
  participacionPorCargo: Array<{
    cargo: string;
    votos: number;
  }>;
  resultados: CandidateResult[];
};
