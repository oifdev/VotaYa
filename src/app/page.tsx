import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  LockKeyhole,
  Vote,
} from "lucide-react";

import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const capabilities = [
  {
    title: "Votacion guiada",
    description:
      "Un flujo claro por cargo, con validacion de identidad y confirmacion antes de emitir el voto.",
    icon: Vote,
  },
  {
    title: "Resultados en vivo",
    description:
      "Graficas por cargo, porcentajes, ganadores y estadisticas generales con Supabase Realtime.",
    icon: BarChart3,
  },
  {
    title: "Seguridad integral",
    description:
      "RLS, restricciones unicas, auditoria administrativa y funciones SQL para evitar duplicidad.",
    icon: LockKeyhole,
  },
  {
    title: "Operacion escalable",
    description:
      "Panel para candidatos, cargos y elecciones con busqueda, filtros, paginacion y exportaciones.",
    icon: Database,
  },
];

export default function Home() {
  return (
    <PublicShell>
      <section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
        <div className="max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-primary" />
            Plataforma lista para comites organizacionales
          </div>
          <h1 className="text-4xl font-bold tracking-normal text-foreground sm:text-5xl lg:text-6xl">
            VotaYa
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
            Sistema moderno de votacion electronica con administracion segura,
            experiencia responsive y resultados auditables en tiempo real.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/votar">
                Iniciar votacion
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/resultados">Ver resultados</Link>
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="grid gap-4 rounded-lg border bg-card/85 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <p className="text-sm text-muted-foreground">Eleccion activa</p>
                <h2 className="text-xl font-semibold">Junta Directiva 2026</h2>
              </div>
              <div className="rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                En vivo
              </div>
            </div>
            <div className="grid gap-3">
              {["Presidente", "Secretario", "Tesorero", "Fiscal"].map(
                (cargo, index) => (
                  <div
                    key={cargo}
                    className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-md border bg-background p-4"
                  >
                    <div>
                      <p className="font-medium">{cargo}</p>
                      <p className="text-sm text-muted-foreground">
                        {index + 2} candidatos registrados
                      </p>
                    </div>
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${72 - index * 11}%` }}
                      />
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y bg-card/55">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {capabilities.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="bg-background/70">
                <CardHeader>
                  <div className="mb-3 grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </PublicShell>
  );
}
