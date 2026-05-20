import type { Metadata } from "next";

import { PublicShell } from "@/components/layout/public-shell";
import { VoteFlow } from "@/components/voting/vote-flow";

export const metadata: Metadata = {
  title: "Votar",
};

export default function VotarPage() {
  return (
    <PublicShell>
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-medium text-primary">Modulo de votacion</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal sm:text-4xl">
            Emision de voto electronico
          </h1>
          <p className="mt-3 text-muted-foreground">
            Valide su identidad, seleccione un candidato por cargo y confirme su
            participacion.
          </p>
        </div>
        <VoteFlow />
      </section>
    </PublicShell>
  );
}
