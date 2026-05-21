import { ZodError } from "zod";
import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ message, details }, { status: 400 });
}

export function serverError(error: unknown) {
  if (error instanceof ZodError) {
    return badRequest("Revise los campos del formulario.", error.flatten());
  }

  console.error("API Error:", error);
  let message = "Ocurrio un error inesperado. Intente nuevamente.";
  
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "object" && error !== null && "message" in error) {
    message = String((error as { message: unknown }).message);
  } else if (typeof error === "string") {
    message = error;
  }

  return NextResponse.json({ message }, { status: 500 });
}

export function sanitizeNullable(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
