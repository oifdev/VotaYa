import { ZodError } from "zod";
import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ message, details }, { status: 400 });
}

export function serverError(error: any) {
  if (error instanceof ZodError) {
    return badRequest("Revise los campos del formulario.", error.flatten());
  }

  console.error("API Error:", error);
  const message = error?.message || "Ocurrio un error inesperado. Intente nuevamente.";
  return NextResponse.json({ message }, { status: 500 });
}

export function sanitizeNullable(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
