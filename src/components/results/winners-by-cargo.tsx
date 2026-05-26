import { Trophy, Vote } from "lucide-react";

import { CandidatePhoto } from "@/components/candidate-photo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPercent } from "@/lib/utils";
import type { ResultsPayload } from "@/types/domain";

type WinnersByCargoProps = {
  results?: ResultsPayload | null;
};

export function WinnersByCargo({ results }: WinnersByCargoProps) {
  const cargos = results?.cargos ?? [];
  const hasVotes = cargos.some((cargo) => cargo.total_votos > 0);

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Ganadores por cargo</CardTitle>
          <Trophy className="size-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        {cargos.length && hasVotes ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {cargos.map((cargo) => {
              const winners = cargo.candidatos.filter((candidate) => candidate.isWinner);

              return (
                <div
                  key={cargo.cargo_id}
                  className="rounded-md border bg-background p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{cargo.cargo_nombre}</p>
                      <p className="text-sm text-muted-foreground">
                        {cargo.total_votos} votos emitidos
                      </p>
                    </div>
                    <Badge variant="outline">{winners.length || 0}</Badge>
                  </div>

                  {winners.length ? (
                    <div className="grid gap-3">
                      {winners.map((winner) => (
                        <div
                          key={winner.candidato_id}
                          className="flex items-center gap-3"
                        >
                          <CandidatePhoto
                            src={winner.foto_url}
                            alt={winner.nombre_completo}
                            className="size-12"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {winner.nombre_completo}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {winner.votos} votos ·{" "}
                              {formatPercent(winner.porcentaje)}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Sin votos registrados para este cargo.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Vote}
            title="Sin ganadores todavia"
            description="Cuando entren votos, aqui se mostrara el candidato lider de cada cargo."
          />
        )}
      </CardContent>
    </Card>
  );
}
