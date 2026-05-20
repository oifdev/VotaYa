import type { Metadata } from "next";

import { EleccionesManager } from "@/components/admin/elecciones-manager";

export const metadata: Metadata = {
  title: "Gestion de elecciones",
};

export default function EleccionesPage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-medium text-primary">Configuracion</p>
        <h1 className="mt-2 text-3xl font-bold tracking-normal">Elecciones</h1>
        <p className="mt-2 text-muted-foreground">
          Controle nombre, fechas, estado y ciclo de cada proceso electoral.
        </p>
      </div>
      <EleccionesManager />
    </div>
  );
}
