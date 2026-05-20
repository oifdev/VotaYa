import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  Home,
  ShieldCheck,
  Trophy,
  Users,
  Vote,
} from "lucide-react";

export const APP_NAME = "VotaYa";
export const APP_DESCRIPTION =
  "Plataforma institucional para elecciones digitales seguras.";

export const publicNavItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/votar", label: "Votar", icon: Vote },
  { href: "/resultados", label: "Resultados", icon: Trophy },
  { href: "/login", label: "Administrador", icon: ShieldCheck },
];

export const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/candidatos", label: "Candidatos", icon: Users },
  { href: "/admin/cargos", label: "Cargos", icon: Boxes },
  { href: "/admin/elecciones", label: "Elecciones", icon: ClipboardCheck },
];

export const candidatePhotoBucket = "candidate-photos";

export const electionStatusLabels = {
  pendiente: "Pendiente",
  activa: "Activa",
  finalizada: "Finalizada",
} as const;

export const recordStatusLabels = {
  activo: "Activo",
  inactivo: "Inactivo",
} as const;
