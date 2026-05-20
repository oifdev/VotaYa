"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, ClipboardCheck, Users, Vote } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercent } from "@/lib/utils";
import type { AuditLog } from "@/types/database";
import type { DashboardStats, ResultsPayload } from "@/types/domain";

type StatsResponse = {
  stats: DashboardStats;
  results: ResultsPayload;
};

const statCards = [
  { key: "totalVotantes", label: "Total votantes", icon: Users },
  { key: "totalVotos", label: "Votos emitidos", icon: Vote },
  { key: "totalCandidatos", label: "Participantes", icon: ClipboardCheck },
  { key: "totalCargos", label: "Cargos", icon: BarChart3 },
] as const;

export function DashboardOverview() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [statsResponse, logsResponse] = await Promise.all([
        fetch("/api/admin/stats", { cache: "no-store" }),
        fetch("/api/admin/audit", { cache: "no-store" }),
      ]);

      if (!statsResponse.ok) throw new Error("No se pudieron cargar metricas.");
      if (!logsResponse.ok) throw new Error("No se pudo cargar auditoria.");

      setData((await statsResponse.json()) as StatsResponse);
      const logsPayload = (await logsResponse.json()) as { logs: AuditLog[] };
      setLogs(logsPayload.logs);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al cargar el dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }

  const topResults = useMemo(
    () =>
      data?.stats.resultados
        .slice()
        .sort((a, b) => b.votos - a.votos)
        .slice(0, 8) ?? [],
    [data],
  );

  if (loading) {
    return (
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((item) => (
            <Skeleton key={item.key} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((item) => {
          const Icon = item.icon;
          const value = stats?.[item.key] ?? 0;

          return (
            <Card key={item.key}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {item.label}
                </CardTitle>
                <Icon className="size-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{value}</div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Participacion promedio{" "}
                  {formatPercent(data?.results.totals.participacionPromedio ?? 0)}%
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>Participacion por cargo</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.participacionPorCargo.length ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.participacionPorCargo}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="cargo" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "rgba(15, 107, 79, 0.08)" }} />
                    <Bar dataKey="votos" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                icon={BarChart3}
                title="Sin votos registrados"
                description="Cuando los votantes participen, esta grafica se actualizara con los votos por cargo."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultados destacados</CardTitle>
          </CardHeader>
          <CardContent>
            {topResults.length ? (
              <div className="grid gap-3">
                {topResults.map((item) => (
                  <div
                    key={item.candidato_id}
                    className="rounded-md border bg-background p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.nombre_completo}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.cargo_nombre}
                        </p>
                      </div>
                      {item.isWinner && <Badge variant="success">Ganador</Badge>}
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(item.porcentaje, 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.votos} votos · {formatPercent(item.porcentaje)}%
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Vote}
                title="Aun no hay resultados"
                description="Los resultados aparecen aqui despues de recibir votos."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Auditoria administrativa reciente</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length ? (
            <div className="grid gap-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-1 rounded-md border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{log.action}</p>
                    <p className="text-sm text-muted-foreground">
                      {log.entity_type} · {log.entity_id ?? "sin entidad"}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat("es-HN", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(log.created_at))}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ClipboardCheck}
              title="Sin eventos administrativos"
              description="Las acciones de gestion quedan registradas para trazabilidad."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
