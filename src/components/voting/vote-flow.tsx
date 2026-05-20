"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  ShieldCheck,
  Vote,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Modal } from "@/components/ui/modal";

import { CandidatePhoto } from "@/components/candidate-photo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { formatDateTime } from "@/lib/utils";
import { voterSchema, type VoterFormValues } from "@/lib/validators";
import type { VotingContext } from "@/types/domain";

type Step = "identity" | "ballot" | "confirm" | "done";

export function VoteFlow() {
  const [context, setContext] = useState<VotingContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("identity");
  const [voter, setVoter] = useState<VoterFormValues | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [alreadyVotedOpen, setAlreadyVotedOpen] = useState(false);

  const allCargosAssigned = useMemo(() => {
    if (!context) return false;
    return context.cargos.every((cargo) => selections[cargo.id]);
  }, [context, selections]);

  function handleSelect(candidateId: string, newCargoId: string) {
    setSelections((current) => {
      const updated = { ...current };
      
      const previousCargoId = Object.entries(updated).find(
        ([, cId]) => cId === candidateId
      )?.[0];
      if (previousCargoId) {
        delete updated[previousCargoId];
      }
      
      if (newCargoId) {
        updated[newCargoId] = candidateId;
      }
      
      return updated;
    });
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VoterFormValues>({
    resolver: zodResolver(voterSchema),
    defaultValues: {
      nombre_completo: "",
      identidad: "",
    },
  });

  useEffect(() => {
    async function loadContext() {
      try {
        const response = await fetch("/api/voting/context", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("No se pudo cargar la votacion.");
        setContext((await response.json()) as VotingContext);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Error al cargar la votacion.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadContext();
  }, []);

  async function validateVoter(values: VoterFormValues) {
    if (!context?.election) return;

    const response = await fetch("/api/voting/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eleccion_id: context.election.id,
        identidad: values.identidad,
      }),
    });

    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message);
    if (payload.alreadyVoted) {
      setAlreadyVotedOpen(true);
      return;
    }

    setVoter(values);
    setStep("ballot");
  }

  async function submitVote() {
    if (!context?.election || !voter) return;

    const missing = context.cargos.filter((cargo) => !selections[cargo.id]);
    if (missing.length) {
      toast.error("Seleccione un candidato por cada cargo.");
      setStep("ballot");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/voting/cast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eleccion_id: context.election.id,
          votante: voter,
          selections: Object.entries(selections).map(([cargo_id, candidato_id]) => ({
            cargo_id,
            candidato_id,
          })),
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);

      toast.success("Su voto ha sido registrado exitosamente.");
      setStep("done");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo registrar el voto.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const selectedSummary = useMemo(() => {
    if (!context) return [];
    return context.cargos.map((cargo) => ({
      cargo,
      candidato: context.candidatos.find(
        (candidate) => candidate.id === selections[cargo.id],
      ),
    }));
  }, [context, selections]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex min-h-96 items-center justify-center">
          <Spinner className="size-8" />
        </CardContent>
      </Card>
    );
  }

  if (!context?.election || context.election.estado !== "activa") {
    return (
      <EmptyState
        icon={AlertCircle}
        title="No hay una eleccion activa"
        description="El comite organizador aun no ha abierto un proceso de votacion."
      />
    );
  }

  if (!context.cargos.length || !context.candidatos.length) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Boleta sin candidatos o cargos"
        description="La eleccion activa necesita cargos y candidatos registrados para iniciar."
      />
    );
  }

  return (
    <div className="grid gap-6">
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>{context.election.nombre}</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Cierre: {formatDateTime(context.election.fecha_cierre)}
              </p>
            </div>
            <Badge variant="success">Eleccion activa</Badge>
          </div>
        </CardHeader>
      </Card>

      {step === "identity" && (
        <Card>
          <CardHeader>
            <CardTitle>Identificacion del votante</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Sus datos se validan para evitar votos duplicados en esta eleccion.
            </p>
          </CardHeader>
          <CardContent>
            <form
              className="grid max-w-2xl gap-4"
              onSubmit={handleSubmit(validateVoter)}
            >
              <div className="grid gap-2">
                <Label htmlFor="nombre_completo">Nombre completo</Label>
                <Input
                  id="nombre_completo"
                  placeholder="Nombre y apellidos"
                  {...register("nombre_completo")}
                />
                {errors.nombre_completo && (
                  <p className="text-sm text-destructive">
                    {errors.nombre_completo.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="identidad">Numero de identidad</Label>
                <Input
                  id="identidad"
                  placeholder="0000-0000-00000"
                  {...register("identidad")}
                />
                {errors.identidad && (
                  <p className="text-sm text-destructive">
                    {errors.identidad.message}
                  </p>
                )}
              </div>
              <Button className="w-fit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Spinner /> : <ShieldCheck className="size-4" />}
                Validar identidad
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "ballot" && (
        <div className="grid gap-5">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-bold tracking-tight">Asignación de Cargos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Asigne los cargos correspondientes a cada candidato de su preferencia. Un mismo cargo no puede ser asignado a más de un candidato.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {context.cargos.map((cargo) => {
                const assigned = !!selections[cargo.id];
                return (
                  <Badge
                    key={cargo.id}
                    variant={assigned ? "success" : "secondary"}
                    className="px-2.5 py-1 text-xs"
                  >
                    {cargo.nombre}: {assigned ? "Asignado" : "Pendiente"}
                  </Badge>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {context.candidatos.map((candidate) => {
              const selectedCargoId = Object.entries(selections).find(
                ([, cId]) => cId === candidate.id
              )?.[0] || "";
              const selectedCargoName = context.cargos.find(c => c.id === selectedCargoId)?.nombre;

              return (
                <Card 
                  key={candidate.id} 
                  className={`flex flex-col overflow-hidden transition-all duration-300 ${
                    selectedCargoId ? "border-primary/50 ring-1 ring-primary/10 shadow-md" : "hover:border-primary/30"
                  }`}
                >
                  <div className="relative">
                    <CandidatePhoto
                      src={candidate.foto_url}
                      alt={candidate.nombre_completo}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    {selectedCargoId && (
                      <div className="absolute top-3 right-3">
                        <Badge className="shadow-lg bg-primary text-primary-foreground">
                          {selectedCargoName}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="flex flex-1 flex-col justify-between p-5">
                    <div className="mb-4">
                      <h3 className="font-semibold text-lg leading-tight">{candidate.nombre_completo}</h3>
                      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                        {candidate.biografia ?? "Sin biografia registrada."}
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`cargo-select-${candidate.id}`} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Asignar Cargo
                      </Label>
                      <select
                        id={`cargo-select-${candidate.id}`}
                        value={selectedCargoId}
                        onChange={(e) => handleSelect(candidate.id, e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all duration-200"
                      >
                        <option value="">Ninguno (No asignado)</option>
                        {context.cargos.map((cargo) => {
                          const isAssignedToOther = selections[cargo.id] && selections[cargo.id] !== candidate.id;
                          return (
                            <option key={cargo.id} value={cargo.id} disabled={!!isAssignedToOther}>
                              {cargo.nombre} {isAssignedToOther ? "(Asignado)" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("identity")}
            >
              <ChevronLeft className="size-4" />
              Volver
            </Button>
            <Button 
              type="button" 
              onClick={() => setStep("confirm")}
              disabled={!allCargosAssigned}
            >
              Revisar voto
              <Vote className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {step === "confirm" && (
        <Card>
          <CardHeader>
            <CardTitle>Confirmar voto</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Revise el resumen antes de registrar su voto de forma definitiva.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {selectedSummary.map(({ cargo, candidato }) => (
                <div
                  key={cargo.id}
                  className="flex items-center justify-between gap-4 rounded-md border bg-background p-4"
                >
                  <div>
                    <p className="text-sm text-muted-foreground">{cargo.nombre}</p>
                    <p className="font-medium">
                      {candidato?.nombre_completo ?? "Sin seleccion"}
                    </p>
                  </div>
                  {candidato ? (
                    <CheckCircle2 className="size-5 text-primary" />
                  ) : (
                    <AlertCircle className="size-5 text-destructive" />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("ballot")}
              >
                <ChevronLeft className="size-4" />
                Editar seleccion
              </Button>
              <Button type="button" disabled={submitting} onClick={submitVote}>
                {submitting ? <Spinner /> : <Vote className="size-4" />}
                Confirmar voto
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card className="border-primary/20">
          <CardContent className="flex min-h-80 flex-col items-center justify-center text-center">
            <div className="mb-5 grid size-16 place-items-center rounded-lg bg-primary text-primary-foreground">
              <CheckCircle2 className="size-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-normal">
              Su voto ha sido registrado exitosamente
            </h2>
            <p className="mt-3 max-w-md text-muted-foreground">
              Gracias por participar. El sistema bloqueo esta identidad para
              evitar registros duplicados en la misma eleccion.
            </p>
          </CardContent>
        </Card>
      )}
      <Modal
        open={alreadyVotedOpen}
        onClose={() => setAlreadyVotedOpen(false)}
        title="Voto ya registrado"
        description="Esta identidad ya registro su voto en esta eleccion. No es posible votar mas de una vez."
        variant="info"
      />
    </div>
  );
}


