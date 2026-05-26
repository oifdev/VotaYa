import type { Metadata } from "next";

import { PadronManager } from "@/components/admin/padron-manager";

export const metadata: Metadata = {
  title: "Padron electoral",
};

export default function PadronPage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-medium text-primary">Participantes</p>
        <h1 className="mt-2 text-3xl font-bold tracking-normal">Padron</h1>
        <p className="mt-2 text-muted-foreground">
          Registre identidades habilitadas para votar. El votante solo ingresa su identidad y el sistema valida contra este padron.
        </p>
      </div>
      <PadronManager />
    </div>
  );
}

