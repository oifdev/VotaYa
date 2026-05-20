import type { Metadata } from "next";

import { CandidatosManager } from "@/components/admin/candidatos-manager";

export const metadata: Metadata = {
  title: "Gestion de candidatos",
};

export default function CandidatosPage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-medium text-primary">Participantes</p>
        <h1 className="mt-2 text-3xl font-bold tracking-normal">Candidatos</h1>
        <p className="mt-2 text-muted-foreground">
          Cree, edite y publique candidatos con fotografia en Supabase Storage.
        </p>
      </div>
      <CandidatosManager />
    </div>
  );
}
