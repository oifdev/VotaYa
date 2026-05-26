import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Sin definir";

  return new Intl.DateTimeFormat("es-HN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("es-HN", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(value);
}

export function normalizeIdentity(value: string) {
  return value.replace(/\D/g, "");
}

export function maskIdentity(value: string) {
  const normalized = normalizeIdentity(value);
  if (normalized.length < 4) return "****";
  return `****-****-${normalized.slice(-5)}`;
}

export function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function absoluteUrl(path: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";

  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getBallotNumber(value?: string | null) {
  const match = value?.match(/casilla\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

export function compareByBallotNumber<
  T extends { biografia?: string | null; nombre_completo: string },
>(first: T, second: T) {
  const firstNumber = getBallotNumber(first.biografia);
  const secondNumber = getBallotNumber(second.biografia);

  if (firstNumber !== null && secondNumber !== null) {
    return firstNumber - secondNumber;
  }

  if (firstNumber !== null) return -1;
  if (secondNumber !== null) return 1;

  return first.nombre_completo.localeCompare(second.nombre_completo, "es-HN");
}
