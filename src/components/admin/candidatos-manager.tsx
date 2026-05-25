"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Edit3, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { CandidatePhoto } from "@/components/candidate-photo";
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
import { candidateSchema, type CandidateFormValues } from "@/lib/validators";
import type { Eleccion } from "@/types/database";
import type { CandidateWithRelations } from "@/types/domain";

const pageSize = 8;

export function CandidatosManager() {
  const [items, setItems] = useState<CandidateWithRelations[]>([]);
  const [elecciones, setElecciones] = useState<Eleccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<CandidateWithRelations | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [page, setPage] = useState(1);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [itemToDelete, setItemToDelete] = useState<CandidateWithRelations | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateSchema),
    defaultValues: defaultValues(),
  });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { getCandidatosAction, getEleccionesAction } = await import("@/app/admin/actions");
      const [candidatesResult, electionsResult] = await Promise.all([
        getCandidatosAction(),
        getEleccionesAction(),
      ]);

      if (candidatesResult.error || !candidatesResult.data) {
        throw new Error(candidatesResult.error || "No se pudieron cargar los candidatos.");
      }
      setItems(candidatesResult.data.candidatos);

      if (!electionsResult.error && electionsResult.data) {
        setElecciones(electionsResult.data.elecciones);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(values: CandidateFormValues) {
    setSaving(true);
    try {
      const fotoUrl = photoFile ? await uploadPhoto(photoFile) : values.foto_url;
      const payload = {
        ...values,
        foto_url: fotoUrl || null,
      };

      const { createCandidatoAction, updateCandidatoAction } = await import("@/app/admin/actions");
      const result = editing
        ? await updateCandidatoAction(editing.id, payload)
        : await createCandidatoAction(payload);

      if (result.error) throw new Error(result.error);

      toast.success(editing ? "Candidato actualizado." : "Candidato creado.");
      setEditing(null);
      setPhotoFile(null);
      reset(defaultValues());
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(file: File) {
    const { uploadCandidatePhotoAction } = await import("@/app/admin/actions");
    const formData = new FormData();
    formData.append("file", file);

    const result = await uploadCandidatePhotoAction(formData);
    if (result.error || !result.data) {
      throw new Error(result.error ?? "No se pudo subir la fotografia.");
    }

    return result.data.publicUrl;
  }

  async function confirmRemove() {
    if (!itemToDelete) return;
    try {
      const { deleteCandidatoAction } = await import("@/app/admin/actions");
      const result = await deleteCandidatoAction(itemToDelete.id);
      if (result.error) throw new Error(result.error);
      toast.success("Candidato eliminado.");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el candidato.",
      );
    } finally {
      setItemToDelete(null);
    }
  }

  function startEdit(item: CandidateWithRelations) {
    setEditing(item);
    setPhotoFile(null);
    reset({
      eleccion_id: item.eleccion_id,
      nombre_completo: item.nombre_completo,
      identidad: item.identidad,
      biografia: item.biografia ?? "",
      foto_url: item.foto_url ?? "",
      estado: item.estado,
    });
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus =
        statusFilter === "todos" || item.estado === statusFilter;
      const matchesQuery =
        !normalized ||
        [
          item.nombre_completo,
          item.identidad,
          item.eleccion?.nombre ?? "",
          item.estado,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);

      return matchesStatus && matchesQuery;
    });
  }, [items, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const previewUrl = photoFile
    ? URL.createObjectURL(photoFile)
    : watch("foto_url") || null;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>
            {editing ? "Editar candidato" : "Crear candidato"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="flex items-center gap-4">
              <CandidatePhoto
                src={previewUrl}
                alt={watch("nombre_completo") || "Candidato"}
                className="size-20"
              />
              <div className="grid gap-2">
                <Label htmlFor="photo">Fotografia</Label>
                <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium shadow-sm transition hover:bg-accent">
                  <Upload className="size-4" />
                  Subir imagen
                  <input
                    id="photo"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) =>
                      setPhotoFile(event.target.files?.[0] ?? null)
                    }
                  />
                </label>
              </div>
            </div>

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

            <div className="grid gap-2">
              <Label htmlFor="eleccion_id">Eleccion</Label>
              <Select id="eleccion_id" {...register("eleccion_id")}>
                <option value="">Seleccione</option>
                {elecciones.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
              </Select>
              {errors.eleccion_id && (
                <p className="text-sm text-destructive">
                  {errors.eleccion_id.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="biografia">Descripcion / biografia</Label>
              <Textarea
                id="biografia"
                placeholder="Perfil, experiencia o propuesta"
                {...register("biografia")}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="estado">Estado</Label>
              <Select id="estado" {...register("estado")}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </Select>
            </div>

            <input type="hidden" {...register("foto_url")} />

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner /> : <Plus className="size-4" />}
                {editing ? "Guardar cambios" : "Crear candidato"}
              </Button>
              {editing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditing(null);
                    setPhotoFile(null);
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
          <div className="flex flex-col gap-3">
            <CardTitle>Candidatos registrados</CardTitle>
            <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar candidato"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <Select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
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
            <div className="flex h-48 items-center justify-center">
              <Spinner className="size-6" />
            </div>
          ) : visible.length ? (
            <div className="grid gap-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidato</TableHead>
                    <TableHead>Elección</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <CandidatePhoto
                            src={item.foto_url}
                            alt={item.nombre_completo}
                            className="size-11"
                          />
                          <div>
                            <div className="font-medium">
                              {item.nombre_completo}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {item.identidad}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {item.eleccion?.nombre ?? "Sin eleccion"}
                        </div>
                      </TableCell>
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
                            aria-label="Editar candidato"
                            title="Editar candidato"
                            onClick={() => startEdit(item)}
                          >
                            <Edit3 className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Eliminar candidato"
                            title="Eliminar candidato"
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
              title="Sin candidatos"
              description="Registre participantes y asocielos a un cargo y una eleccion."
            />
          )}
        </CardContent>
      </Card>

      <Modal
        open={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmRemove}
        title="Eliminar candidato"
        description={`¿Está seguro que desea eliminar al candidato "${itemToDelete?.nombre_completo}"? Esta acción no se puede deshacer.`}
        variant="destructive"
        confirmLabel="Eliminar"
      />
    </div>
  );
}

function defaultValues(): CandidateFormValues {
  return {
    eleccion_id: "",
    nombre_completo: "",
    identidad: "",
    biografia: "",
    foto_url: "",
    estado: "activo",
  };
}
