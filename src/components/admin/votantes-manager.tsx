"use client";

import { Download, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatDateTime } from "@/lib/utils";
import type { Eleccion, Votante } from "@/types/database";

const pageSize = 12;

export function VotantesManager() {
  const [elecciones, setElecciones] = useState<Eleccion[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState("");
  const [entries, setEntries] = useState<Votante[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const loadVotantes = useCallback(async (electionId: string, silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(silent);
    try {
      const { getVotantesAction } = await import("@/app/admin/votantes-actions");
      const result = await getVotantesAction(electionId);
      if (result.error || !result.data) {
        throw new Error(result.error || "No se pudieron cargar los votantes.");
      }
      setEntries(result.data.votantes);
      setPage(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar los votantes.");
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
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

      if (initialElectionId) {
        await loadVotantes(initialElectionId);
      } else {
        setEntries([]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }, [loadVotantes]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;

    return entries.filter((entry) => {
      const name = (entry.nombre_completo ?? "").toLowerCase();
      const identity = (entry.identidad_masked ?? "").toLowerCase();
      return name.includes(q) || identity.includes(q);
    });
  }, [entries, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const selectedElectionName = useMemo(() => {
    return elecciones.find((e) => e.id === selectedElectionId)?.nombre ?? "Eleccion";
  }, [elecciones, selectedElectionId]);

  function safeFileName(value: string) {
    return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-").trim();
  }

  function onElectionChange(value: string) {
    setSelectedElectionId(value);
    if (!value) {
      setEntries([]);
      return;
    }
    void loadVotantes(value);
  }

  async function exportExcel() {
    try {
      if (!selectedElectionId) return;

      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Votantes");

      worksheet.columns = [
        { header: "Nombre completo", key: "nombre_completo", width: 36 },
        { header: "Identidad", key: "identidad", width: 18 },
        { header: "Fecha/Hora", key: "fecha", width: 22 },
      ];

      filtered.forEach((entry) => {
        worksheet.addRow({
          nombre_completo: entry.nombre_completo,
          identidad: entry.identidad_masked,
          fecha: formatDateTime(entry.created_at),
        });
      });

      worksheet.getRow(1).font = { bold: true };
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `votantes-${safeFileName(selectedElectionName)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Archivo Excel generado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo exportar.");
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex min-h-96 items-center justify-center">
          <Spinner className="size-8" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Listado de votantes</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Se muestran los votantes que ya registraron su voto en la eleccion seleccionada.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={!selectedElectionId || refreshing}
                onClick={() => selectedElectionId && void loadVotantes(selectedElectionId, true)}
              >
                {refreshing ? <Spinner /> : <RefreshCw className="size-4" />}
                Actualizar
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!selectedElectionId || filtered.length === 0}
                onClick={() => void exportExcel()}
              >
                <Download className="size-4" />
                Excel
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="grid gap-2">
              <Label>Eleccion</Label>
              <Select
                value={selectedElectionId}
                onChange={(event) => onElectionChange(event.target.value)}
              >
                <option value="">Seleccione una eleccion</option>
                {elecciones.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre} ({e.estado})
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Nombre o identidad"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {selectedElectionId && filtered.length ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>
                  Total: <span className="font-medium text-foreground">{filtered.length}</span>
                </span>
                <Badge variant="outline">Pagina {page} de {totalPages}</Badge>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Identidad</TableHead>
                    <TableHead>Fecha/Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.nombre_completo}</TableCell>
                      <TableCell className="font-mono text-sm">{entry.identidad_masked}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(entry.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Mostrando {visible.length} de {filtered.length}
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
              title="Sin votantes registrados"
              description={
                selectedElectionId
                  ? "Aun no hay votos registrados para esta eleccion."
                  : "Seleccione una eleccion para ver el listado."
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
