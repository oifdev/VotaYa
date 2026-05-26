"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Download, RefreshCw, Search, Trash2, Upload, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { padronVotanteSchema, type PadronVotanteFormValues } from "@/lib/validators";
import { recordStatusLabels } from "@/lib/constants";
import type { Eleccion, PadronVotante, RecordStatus } from "@/types/database";

const pageSize = 10;

type ImportSummary = {
  total_validas: number;
  inserted: number;
  updated: number;
  invalid: number;
};

export function PadronManager() {
  const [elecciones, setElecciones] = useState<Eleccion[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState("");
  const [entries, setEntries] = useState<PadronVotante[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<"upsert" | "insert">("upsert");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | RecordStatus>("todos");
  const [page, setPage] = useState(1);
  const [entryToDelete, setEntryToDelete] = useState<PadronVotante | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PadronVotanteFormValues>({
    resolver: zodResolver(padronVotanteSchema),
    defaultValues: defaultValues(""),
  });

  const loadPadron = useCallback(async (electionId: string) => {
    try {
      const { getPadronAction } = await import("@/app/admin/padron-actions");
      const result = await getPadronAction(electionId);
      if (result.error || !result.data) {
        throw new Error(result.error || "No se pudo cargar el padron.");
      }
      setEntries(result.data.padron);
      setPage(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el padron.");
      setEntries([]);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const { getEleccionesAction } = await import("@/app/admin/actions");
      const electionsResult = await getEleccionesAction();
      if (electionsResult.error || !electionsResult.data) {
        throw new Error(electionsResult.error || "No se pudieron cargar las elecciones.");
      }

      const loaded = electionsResult.data.elecciones;
      setElecciones(loaded);

      const initialElectionId = loaded[0]?.id ?? "";
      setSelectedElectionId(initialElectionId);
      reset(defaultValues(initialElectionId));

      if (initialElectionId) {
        await loadPadron(initialElectionId);
      } else {
        setEntries([]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }, [loadPadron, reset]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  async function onSubmit(values: PadronVotanteFormValues) {
    setSaving(true);
    try {
      const { createPadronEntryAction } = await import("@/app/admin/padron-actions");
      const result = await createPadronEntryAction(values);
      if (result.error || !result.data) throw new Error(result.error || "No se pudo registrar.");

      toast.success("Registro agregado al padron.");
      reset(defaultValues(selectedElectionId));
      await loadPadron(selectedElectionId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(entry: PadronVotante) {
    try {
      const next: RecordStatus = entry.estado === "activo" ? "inactivo" : "activo";
      const { setPadronEntryStatusAction } = await import("@/app/admin/padron-actions");
      const result = await setPadronEntryStatusAction(entry.id, next);
      if (result.error || !result.data) throw new Error(result.error || "No se pudo actualizar.");

      toast.success("Estado actualizado.");
      await loadPadron(selectedElectionId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar.");
    }
  }

  async function confirmDelete() {
    if (!entryToDelete) return;
    try {
      const { deletePadronEntryAction } = await import("@/app/admin/padron-actions");
      const result = await deletePadronEntryAction(entryToDelete.id);
      if (result.error) throw new Error(result.error);

      toast.success("Registro eliminado del padron.");
      await loadPadron(selectedElectionId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar.");
    } finally {
      setEntryToDelete(null);
    }
  }

  async function runImport() {
    if (!selectedElectionId) {
      toast.error("Seleccione una eleccion.");
      return;
    }
    if (!importFile) {
      toast.error("Adjunte un archivo Excel (.xlsx).");
      return;
    }

    setImporting(true);
    setImportErrors([]);
    setImportSummary(null);

    try {
      const formData = new FormData();
      formData.append("eleccion_id", selectedElectionId);
      formData.append("mode", importMode);
      formData.append("file", importFile);

      const response = await fetch("/api/admin/padron/import", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        message?: string;
        summary?: ImportSummary;
        errors?: Array<{ row: number; message: string }>;
      };

      if (!response.ok) throw new Error(payload.message || "No se pudo importar el padron.");

      setImportSummary(payload.summary ?? null);
      setImportErrors(payload.errors ?? []);

      toast.success(
        `Padron importado. Nuevos: ${payload.summary?.inserted ?? 0}, actualizados: ${payload.summary?.updated ?? 0}.`,
      );

      setImportFile(null);
      await loadPadron(selectedElectionId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo importar.");
    } finally {
      setImporting(false);
    }
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return entries.filter((entry) => {
      const matchesStatus =
        statusFilter === "todos" || entry.estado === statusFilter;

      const matchesQuery =
        !normalized ||
        [entry.nombre_completo, entry.identidad_masked, entry.estado]
          .join(" ")
          .toLowerCase()
          .includes(normalized);

      return matchesStatus && matchesQuery;
    });
  }, [entries, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Eleccion</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => bootstrap()}
                disabled={loading}
              >
                <RefreshCw className="size-4" />
                Recargar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="eleccion">Eleccion activa para padron</Label>
              <Select
                id="eleccion"
                value={selectedElectionId}
                onChange={(event) => {
                  const next = event.target.value;
                  setSelectedElectionId(next);
                  reset(defaultValues(next));
                  void loadPadron(next);
                }}
                disabled={loading}
              >
                <option value="">Seleccione una eleccion</option>
                {elecciones.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre} ({e.estado})
                  </option>
                ))}
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              El archivo Excel debe tener encabezados <span className="font-medium">nombre_completo</span> e{" "}
              <span className="font-medium">identidad</span> en la primera fila. Para evitar que Excel quite ceros al inicio, formatee la columna de identidad como texto.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registro manual</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
              <input type="hidden" {...register("eleccion_id")} />

              <div className="grid gap-2">
                <Label htmlFor="nombre_completo">Nombre completo</Label>
                <Input
                  id="nombre_completo"
                  placeholder="Nombre y apellidos"
                  {...register("nombre_completo")}
                  disabled={!selectedElectionId || saving}
                />
                {errors.nombre_completo && (
                  <p className="text-sm text-destructive">{errors.nombre_completo.message}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="identidad">Identidad</Label>
                <Input
                  id="identidad"
                  placeholder="0000-0000-00000"
                  {...register("identidad")}
                  disabled={!selectedElectionId || saving}
                />
                {errors.identidad && (
                  <p className="text-sm text-destructive">{errors.identidad.message}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="estado">Estado</Label>
                <Select
                  id="estado"
                  {...register("estado")}
                  disabled={!selectedElectionId || saving}
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </Select>
                {errors.estado && (
                  <p className="text-sm text-destructive">{errors.estado.message}</p>
                )}
              </div>

              <Button type="submit" className="w-fit" disabled={!selectedElectionId || saving}>
                {saving ? <Spinner /> : <UserPlus className="size-4" />}
                Agregar al padron
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Importar desde Excel</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="import-file">Archivo .xlsx</Label>
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium shadow-sm transition hover:bg-accent">
                <Upload className="size-4" />
                {importFile ? importFile.name : "Seleccionar archivo"}
                <input
                  id="import-file"
                  type="file"
                  accept=".xlsx"
                  className="sr-only"
                  onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                  disabled={!selectedElectionId || importing}
                />
              </label>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  id="import-mode"
                  type="checkbox"
                  checked={importMode === "upsert"}
                  onChange={(e) => setImportMode(e.target.checked ? "upsert" : "insert")}
                  disabled={importing}
                />
                <Label htmlFor="import-mode" className="cursor-pointer">
                  Actualizar existentes (upsert)
                </Label>
              </div>
              <Button
                type="button"
                onClick={runImport}
                disabled={!selectedElectionId || importing || !importFile}
              >
                {importing ? <Spinner /> : <Upload className="size-4" />}
                Importar
              </Button>
            </div>

            {importSummary ? (
              <div className="rounded-md border bg-background p-4 text-sm">
                <p className="font-medium">Resumen de importacion</p>
                <div className="mt-2 grid gap-1 text-muted-foreground">
                  <p>Filas validas: {importSummary.total_validas}</p>
                  <p>Nuevos: {importSummary.inserted}</p>
                  <p>Actualizados: {importSummary.updated}</p>
                  <p>Invalidos: {importSummary.invalid}</p>
                </div>
              </div>
            ) : null}

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // A tiny "template": user can copy the headers into Excel quickly.
                navigator.clipboard.writeText("nombre_completo\tidentidad\n");
                toast.success("Plantilla copiada al portapapeles.");
              }}
              disabled={importing}
            >
              <Download className="size-4" />
              Copiar plantilla (encabezados)
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Listado del padron</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o identidad..."
                  className="pl-9 sm:w-72"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as "todos" | RecordStatus);
                  setPage(1);
                }}
                className="sm:w-44"
              >
                <option value="todos">Todos</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-80 items-center justify-center">
              <Spinner className="size-7" />
            </div>
          ) : selectedElectionId && filtered.length ? (
            <div className="grid gap-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Identidad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.nombre_completo}</TableCell>
                      <TableCell className="font-mono text-sm">{entry.identidad_masked}</TableCell>
                      <TableCell>
                        <Badge variant={entry.estado === "activo" ? "success" : "secondary"}>
                          {recordStatusLabels[entry.estado]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => toggleStatus(entry)}
                          >
                            {entry.estado === "activo" ? "Inactivar" : "Activar"}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label="Eliminar registro"
                            title="Eliminar registro"
                            onClick={() => setEntryToDelete(entry)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Pagina {page} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Search}
              title="Sin registros"
              description={
                selectedElectionId
                  ? "Agregue registros manualmente o importe el padron desde Excel."
                  : "Primero cree una eleccion para gestionar el padron."
              }
            />
          )}
        </CardContent>
      </Card>

      <Modal
        open={!!entryToDelete}
        onClose={() => setEntryToDelete(null)}
        onConfirm={confirmDelete}
        title="Eliminar registro"
        description={`Esta seguro que desea eliminar del padron a "${entryToDelete?.nombre_completo}" (${entryToDelete?.identidad_masked})?`}
        variant="destructive"
        confirmLabel="Eliminar"
      />

      <Modal
        open={importErrors.length > 0}
        onClose={() => setImportErrors([])}
        title="Errores de importacion"
        description={
          importErrors.length
            ? `Se detectaron ${importErrors.length} filas con error. Corrija el archivo y vuelva a importar.`
            : undefined
        }
        variant="info"
      >
        {importErrors.length ? (
          <div className="mt-2 max-h-72 overflow-auto rounded-md border bg-background p-3 text-sm">
            <ul className="grid gap-2">
              {importErrors.slice(0, 20).map((err) => (
                <li key={`${err.row}-${err.message}`}>
                  <span className="font-medium">Fila {err.row}:</span> {err.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function defaultValues(electionId: string): PadronVotanteFormValues {
  return {
    eleccion_id: electionId,
    nombre_completo: "",
    identidad: "",
    estado: "activo",
  };
}
