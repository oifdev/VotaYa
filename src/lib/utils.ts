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
