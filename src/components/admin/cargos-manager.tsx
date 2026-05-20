"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Edit3, Plus, Search, Trash2, X } from "lucide-react";
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
import { cargoSchema, type CargoFormValues } from "@/lib/validators";
import type { Cargo } from "@/types/database";

const pageSize = 8;

export function CargosManager() {
  const [items, setItems] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Cargo | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [itemToDelete, setItemToDelete] = useState<Cargo | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CargoFormValues>({
    resolver: zodResolver(cargoSchema),
    defaultValues: {
      nombre: "",
      descripcion: "",
      max_candidatos: 5,
      estado: "activo",
      orden: 0,
    },
  });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/cargos", { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudieron cargar los cargos.");
      const payload = (await response.json()) as { cargos: Cargo[] };
      setItems(payload.cargos);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(values: CargoFormValues) {
    setSaving(true);
    try {
      const response = await fetch(
        editing ? `/api/admin/cargos/${editing.id}` : "/api/admin/cargos",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);

      toast.success(editing ? "Cargo actualizado." : "Cargo creado.");
      setEditing(null);
      reset({
        nombre: "",
        descripcion: "",
        max_candidatos: 5,
        estado: "activo",
        orden: 0,
      });
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
      const response = await fetch(`/api/admin/cargos/${itemToDelete.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      toast.success("Cargo eliminado.");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el cargo.",
      );
    } finally {
      setItemToDelete(null);
    }
  }

  function startEdit(item: Cargo) {
    setEditing(item);
    reset({
      nombre: item.nombre,
      descripcion: item.descripcion ?? "",
      max_candidatos: item.max_candidatos,
      estado: item.estado,
      orden: item.orden,
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
          <CardTitle>{editing ? "Editar cargo" : "Crear cargo"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-2">
              <Label htmlFor="nombre">Nombre del cargo</Label>
              <Input id="nombre" placeholder="Presidente" {...register("nombre")} />
              {errors.nombre && (
                <p className="text-sm text-destructive">{errors.nombre.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="descripcion">Descripcion</Label>
              <Textarea
                id="descripcion"
                placeholder="Responsabilidad o alcance del cargo"
                {...register("descripcion")}
              />
              {errors.descripcion && (
                <p className="text-sm text-destructive">
                  {errors.descripcion.message}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="max_candidatos">Maximo</Label>
                <Input
                  id="max_candidatos"
                  type="number"
                  min={1}
                  {...register("max_candidatos", { valueAsNumber: true })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="orden">Orden</Label>
                <Input
                  id="orden"
                  type="number"
                  min={0}
                  {...register("orden", { valueAsNumber: true })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="estado">Estado</Label>
                <Select id="estado" {...register("estado")}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner /> : <Plus className="size-4" />}
                {editing ? "Guardar cambios" : "Crear cargo"}
              </Button>
              {editing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditing(null);
                    reset({
                      nombre: "",
                      descripcion: "",
                      max_candidatos: 5,
                      estado: "activo",
                      orden: 0,
                    });
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
            <CardTitle>Cargos configurados</CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar cargo"
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
                    <TableHead>Nombre</TableHead>
                    <TableHead>Max.</TableHead>
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
                          Orden {item.orden}
                        </div>
                      </TableCell>
                      <TableCell>{item.max_candidatos}</TableCell>
                      <TableCell>
                        <Badge
                          variant={item.estado === "activo" ? "success" : "secondary"}
                        >
                          {item.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Editar cargo"
                            title="Editar cargo"
                            onClick={() => startEdit(item)}
                          >
                            <Edit3 className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Eliminar cargo"
                            title="Eliminar cargo"
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
              icon={Search}
              title="Sin cargos"
              description="Cree los cargos que formaran parte de la eleccion."
            />
          )}
        </CardContent>
      </Card>

      <Modal
        open={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmRemove}
        title="Eliminar cargo"
        description={`¿Está seguro que desea eliminar el cargo "${itemToDelete?.nombre}"? Esta acción no se puede deshacer.`}
        variant="destructive"
        confirmLabel="Eliminar"
      />
    </div>
  );
}
