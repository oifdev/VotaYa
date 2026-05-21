"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, Edit3, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { electionStatusLabels } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { electionSchema, type ElectionFormValues } from "@/lib/validators";
import type { Eleccion, ElectionStatus } from "@/types/database";

const pageSize = 8;

export function EleccionesManager() {
  const [items, setItems] = useState<Eleccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Eleccion | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [itemToDelete, setItemToDelete] = useState<Eleccion | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ElectionFormValues>({
    resolver: zodResolver(electionSchema),
    defaultValues: {
      nombre: "",
      descripcion: "",
      fecha_inicio: "",
      fecha_cierre: "",
      estado: "pendiente",
    },
  });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/elecciones", { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "No se pudieron cargar las elecciones.");
      }
      const payload = (await response.json()) as { elecciones: Eleccion[] };
      setItems(payload.elecciones);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(values: ElectionFormValues) {
    setSaving(true);
    try {
      const payload = {
        ...values,
        fecha_inicio: new Date(values.fecha_inicio).toISOString(),
        fecha_cierre: new Date(values.fecha_cierre).toISOString(),
      };
      const response = await fetch(
        editing ? `/api/admin/elecciones/${editing.id}` : "/api/admin/elecciones",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const body = await response.json();
      if (!response.ok) throw new Error(body.message);

      toast.success(editing ? "Eleccion actualizada." : "Eleccion creada.");
      setEditing(null);
      reset(defaultValues());
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!itemToDelete) return;

    try {
      const response = await fetch(`/api/admin/elecciones/${itemToDelete.id}`, {
        method: "DELETE",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      toast.success("Eleccion eliminada.");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la eleccion.",
      );
    } finally {
      setItemToDelete(null);
    }
  }

  function startEdit(item: Eleccion) {
    setEditing(item);
    reset({
      nombre: item.nombre,
      descripcion: item.descripcion ?? "",
      fecha_inicio: toDateTimeLocal(item.fecha_inicio),
      fecha_cierre: toDateTimeLocal(item.fecha_cierre),
      estado: item.estado,
    });
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) =>
      [item.nombre, item.descripcion ?? "", item.estado]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [items, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <CardHeader>
          <CardTitle>{editing ? "Editar eleccion" : "Crear eleccion"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                placeholder="Eleccion de Comite 2026"
                {...register("nombre")}
              />
              {errors.nombre && (
                <p className="text-sm text-destructive">{errors.nombre.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="descripcion">Descripcion</Label>
              <Textarea
                id="descripcion"
                placeholder="Periodo, alcance o notas internas"
                {...register("descripcion")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="fecha_inicio">Inicio</Label>
                <Input
                  id="fecha_inicio"
                  type="datetime-local"
                  {...register("fecha_inicio")}
                />
                {errors.fecha_inicio && (
                  <p className="text-sm text-destructive">
                    {errors.fecha_inicio.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fecha_cierre">Cierre</Label>
                <Input
                  id="fecha_cierre"
                  type="datetime-local"
                  {...register("fecha_cierre")}
                />
                {errors.fecha_cierre && (
                  <p className="text-sm text-destructive">
                    {errors.fecha_cierre.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="estado">Estado</Label>
              <Select id="estado" {...register("estado")}>
                <option value="pendiente">Pendiente</option>
                <option value="activa">Activa</option>
                <option value="finalizada">Finalizada</option>
              </Select>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner /> : <Plus className="size-4" />}
                {editing ? "Guardar cambios" : "Crear eleccion"}
              </Button>
              {editing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditing(null);
                    reset(defaultValues());
                  }}
                >
                  <X className="size-4" />
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Elecciones</CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar eleccion"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Spinner className="size-6" />
            </div>
          ) : visible.length ? (
            <div className="grid gap-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Eleccion</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.nombre}</div>
                        <div className="text-sm text-muted-foreground">
                          {item.descripcion ?? "Sin descripcion"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{formatDateTime(item.fecha_inicio)}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDateTime(item.fecha_cierre)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(item.estado)}>
                          {electionStatusLabels[item.estado]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Editar eleccion"
                            title="Editar eleccion"
                            onClick={() => startEdit(item)}
                          >
                            <Edit3 className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Eliminar eleccion"
                            title="Eliminar eleccion"
                            onClick={() => setItemToDelete(item)}
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
                    onClick={() =>
                      setPage((value) => Math.min(totalPages, value + 1))
                    }
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="Sin elecciones"
              description="Configure una eleccion para habilitar candidatos, votacion y resultados."
            />
          )}
        </CardContent>
      </Card>

      <Modal
        open={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmRemove}
        title="Eliminar eleccion"
        description={`¿Está seguro que desea eliminar la eleccion "${itemToDelete?.nombre}"? Esta acción no se puede deshacer.`}
        variant="destructive"
        confirmLabel="Eliminar"
      />
    </div>
  );
}

function defaultValues(): ElectionFormValues {
  return {
    nombre: "",
    descripcion: "",
    fecha_inicio: "",
    fecha_cierre: "",
    estado: "pendiente",
  };
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function statusVariant(status: ElectionStatus): "success" | "warning" | "secondary" {
  if (status === "activa") return "success";
  if (status === "pendiente") return "warning";
  return "secondary";
}
