import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import { PublicShell } from "@/components/layout/public-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Inicio de sesion",
};

export default function LoginPage() {
  return (
    <PublicShell>
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <div className="hidden max-w-xl lg:block">
          <div className="mb-5 grid size-14 place-items-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-7" />
          </div>
          <h1 className="text-4xl font-bold tracking-normal">
            Administracion segura para elecciones internas
          </h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            Acceda al panel para gestionar cargos, candidatos, configuracion de
            elecciones, auditoria y resultados operativos.
          </p>
        </div>

        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <CardTitle>Inicio de sesion</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Use las credenciales del administrador registradas en Supabase Auth.
            </p>
          </CardHeader>
          <CardContent>
            <Suspense>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </section>
    </PublicShell>
  );
}
