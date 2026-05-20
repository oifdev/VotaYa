"use client";

import { Download, FileSpreadsheet, Trophy, Wifi } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";

import { CandidatePhoto } from "@/components/candidate-photo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import {
  createSupabaseBrowserClient,
  hasSupabaseBrowserEnv,
} from "@/lib/supabase/client";
import { formatDateTime, formatPercent } from "@/lib/utils";
import type { ResultsPayload } from "@/types/domain";

const colors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function ResultsDashboard() {
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadResults = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(silent);
    try {
      const response = await fetch("/api/results", { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudieron cargar los resultados.");
      setResults((await response.json()) as ResultsPayload);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al cargar resultados.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  useEffect(() => {
    const interval = window.setInterval(() => void loadResults(true), 15000);

    if (!hasSupabaseBrowserEnv()) {
      return () => window.clearInterval(interval);
    }

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("public-results")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votos" },
        () => void loadResults(true),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "candidatos" },
        () => void loadResults(true),
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [loadResults]);

  const flatResults = useMemo(() => {
    if (!results) return [];
    const grouped: Record<string, { candidato_id: string; nombre_completo: string; votos: number }> = {};
    results.cargos.forEach((cargo) => {
      cargo.candidatos.forEach((candidate) => {
        if (!grouped[candidate.candidato_id]) {
          grouped[candidate.candidato_id] = {
            candidato_id: candidate.candidato_id,
            nombre_completo: candidate.nombre_completo,
            votos: 0,
          };
        }
        grouped[candidate.candidato_id].votos += candidate.votos;
      });
    });
    return Object.values(grouped).sort((a, b) => b.votos - a.votos);
  }, [results]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex min-h-96 items-center justify-center">
          <Spinner className="size-8" />
        </CardContent>
      </Card>
    );
  }

  if (!results?.election) {
    return (
      <EmptyState
        icon={Trophy}
        title="Sin eleccion disponible"
        description="Los resultados apareceran cuando exista una eleccion configurada."
      />
    );
  }

  return (
    <div className="grid gap-6">
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>{results.election.nombre}</CardTitle>
                <Badge variant={results.election.estado === "activa" ? "success" : "secondary"}>
                  {results.election.estado}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Ultima actualizacion: {formatDateTime(results.updatedAt)}
                {refreshing && " · actualizando"}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => exportPdf(results)}>
                <Download className="size-4" />
                PDF
              </Button>
              <Button variant="outline" onClick={() => void exportExcel(results)}>
                <FileSpreadsheet className="size-4" />
                Excel
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Votantes" value={results.totals.votantes} />
        <Metric label="Votos emitidos" value={results.totals.votos} />
        <Metric label="Cargos" value={results.totals.cargos} />
        <Metric
          label="Participacion"
          value={`${formatPercent(results.totals.participacionPromedio)}%`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>Votos por candidato</CardTitle>
          </CardHeader>
          <CardContent>
            {flatResults.length ? (
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={flatResults}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="nombre_completo"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "rgba(15, 107, 79, 0.08)" }} />
                    <Bar dataKey="votos" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                icon={Trophy}
                title="Sin votos"
                description="Los votos se mostraran en cuanto sean emitidos."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribucion general</CardTitle>
          </CardHeader>
          <CardContent>
            {flatResults.length ? (
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={flatResults}
                      dataKey="votos"
                      nameKey="nombre_completo"
                      innerRadius={70}
                      outerRadius={125}
                      paddingAngle={2}
                    >
                      {flatResults.map((entry, index) => (
                        <Cell
                          key={entry.candidato_id}
                          fill={colors[index % colors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                icon={Wifi}
                title="Esperando datos"
                description="Realtime refrescara la vista cuando entren votos."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5">
        {results.cargos.map((cargo) => (
          <Card key={cargo.cargo_id}>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>{cargo.cargo_nombre}</CardTitle>
                <Badge variant="outline">{cargo.total_votos} votos</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {cargo.candidatos.map((candidate) => (
                  <div
                    key={candidate.candidato_id}
                    className="rounded-md border bg-background p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <CandidatePhoto
                        src={candidate.foto_url}
                        alt={candidate.nombre_completo}
                        className="size-16"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold">
                              {candidate.nombre_completo}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {candidate.votos} votos ·{" "}
                              {formatPercent(candidate.porcentaje)}%
                            </p>
                          </div>
                          {candidate.isWinner && (
                            <Badge variant="success">Ganador</Badge>
                          )}
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{
                              width: `${Math.min(candidate.porcentaje, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function exportPdf(results: ResultsPayload) {
  const doc = new jsPDF();
  doc.text(`Resultados - ${results.election?.nombre ?? "Eleccion"}`, 14, 16);

  autoTable(doc, {
    startY: 24,
    head: [["Cargo", "Candidato", "Votos", "Porcentaje", "Ganador"]],
    body: results.cargos.flatMap((cargo) =>
      cargo.candidatos.map((candidate) => [
        cargo.cargo_nombre,
        candidate.nombre_completo,
        candidate.votos,
        `${formatPercent(candidate.porcentaje)}%`,
        candidate.isWinner ? "Si" : "",
      ]),
    ),
  });

  doc.save("resultados-votaya.pdf");
}

async function exportExcel(results: ResultsPayload) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Resultados");

  worksheet.columns = [
    { header: "Cargo", key: "cargo", width: 24 },
    { header: "Candidato", key: "candidato", width: 34 },
    { header: "Votos", key: "votos", width: 12 },
    { header: "Porcentaje", key: "porcentaje", width: 14 },
    { header: "Ganador", key: "ganador", width: 12 },
  ];

  results.cargos.forEach((cargo) => {
    cargo.candidatos.forEach((candidate) => {
      worksheet.addRow({
        cargo: cargo.cargo_nombre,
        candidato: candidate.nombre_completo,
        votos: candidate.votos,
        porcentaje: `${formatPercent(candidate.porcentaje)}%`,
        ganador: candidate.isWinner ? "Si" : "No",
      });
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
  link.download = "resultados-votaya.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}
