import type { Metadata } from "next";

import { CargosManager } from "@/components/admin/cargos-manager";

export const metadata: Metadata = {
  title: "Gestion de cargos",
};

export default function CargosPage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-medium text-primary">Configuracion</p>
        <h1 className="mt-2 text-3xl font-bold tracking-normal">Cargos</h1>
        <p className="mt-2 text-muted-foreground">
          Defina puestos, capacidad maxima de candidatos y disponibilidad.
        </p>
      </div>
      <CargosManager />
    </div>
  );
}
