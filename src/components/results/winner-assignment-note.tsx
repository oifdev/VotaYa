import { Info } from "lucide-react";

type WinnerAssignmentNoteProps = {
  cargos?: Array<{ cargo_nombre: string }> | null;
};

export function WinnerAssignmentNote({ cargos }: WinnerAssignmentNoteProps) {
  const names = (cargos ?? []).map((cargo) => cargo.cargo_nombre).filter(Boolean);
  const priority = names.length ? names.join(" > ") : null;

  return (
    <div className="rounded-md border bg-muted/10 px-4 py-3 text-sm">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 size-4 text-primary" />
        <div className="grid gap-1">
          <p className="font-medium">Regla de ganadores (sin duplicados)</p>
          <p className="text-muted-foreground">
            Un candidato solo puede ganar un cargo. Si una misma persona queda
            lider en varios cargos, se le asigna el cargo de mayor prioridad y
            los demas cargos pasan al siguiente candidato con mas votos.
          </p>
          {priority ? (
            <p className="text-muted-foreground">
              Prioridad: <span className="font-medium text-foreground">{priority}</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

