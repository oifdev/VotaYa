import type { Metadata } from "next";

import { PublicShell } from "@/components/layout/public-shell";
import { ResultsDashboard } from "@/components/results/results-dashboard";

export const metadata: Metadata = {
  title: "Resultados",
};

export default function ResultadosPage() {
  return (
    <PublicShell>
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-medium text-primary">Modulo de resultados</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal sm:text-4xl">
            Resultados en tiempo real
          </h1>
          <p className="mt-3 text-muted-foreground">
            Consulte votos, porcentajes, ganadores por cargo y estadisticas
            generales con actualizacion automatica.
          </p>
        </div>
        <ResultsDashboard />
      </section>
    </PublicShell>
  );
}
