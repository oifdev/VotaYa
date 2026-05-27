import type { Metadata } from "next";

import { VotantesManager } from "@/components/admin/votantes-manager";

export const metadata: Metadata = {
  title: "Votantes",
};

export default function VotantesPage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-medium text-primary">Historial</p>
        <h1 className="mt-2 text-3xl font-bold tracking-normal">Votantes</h1>
        <p className="mt-2 text-muted-foreground">
          Listado de identidades que ya registraron su voto en una eleccion.
        </p>
      </div>

      <VotantesManager />
    </div>
  );
}

