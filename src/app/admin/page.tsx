import type { Metadata } from "next";

import { DashboardOverview } from "@/components/admin/dashboard-overview";

export const metadata: Metadata = {
  title: "Panel administrativo",
};

export default function AdminPage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-medium text-primary">Panel administrativo</p>
        <h1 className="mt-2 text-3xl font-bold tracking-normal">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Monitoreo operativo de votantes, votos, cargos, candidatos y auditoria.
        </p>
      </div>
      <DashboardOverview />
    </div>
  );
}
