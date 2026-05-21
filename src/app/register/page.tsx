import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { RegisterForm } from "@/components/auth/register-form";
import { PublicShell } from "@/components/layout/public-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Registro de organizador",
};

export default function RegisterPage() {
  return (
    <PublicShell>
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <div className="hidden max-w-xl lg:block">
          <div className="mb-5 grid size-14 place-items-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-7" />
          </div>
          <h1 className="text-4xl font-bold tracking-normal">
            Crea tu propio ecosistema de votacion
          </h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            Al registrarte como organizador, tendras acceso a un panel privado y
            completamente aislado donde podras configurar tus elecciones, cargos,
            y candidatos de forma autonoma.
          </p>
        </div>

        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <CardTitle>Registro de organizador</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Crea una cuenta gratuita para gestionar tus elecciones.
            </p>
          </CardHeader>
          <CardContent>
            <RegisterForm />
            
            <div className="mt-6 text-center text-sm text-muted-foreground">
              ¿Ya tienes una cuenta?{" "}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Inicia sesion
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </PublicShell>
  );
}
