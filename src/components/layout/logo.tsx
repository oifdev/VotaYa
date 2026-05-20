import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

type LogoProps = {
  compact?: boolean;
  className?: string;
};

export function Logo({ compact = false, className }: LogoProps) {
  return (
    <Link href="/" className={cn("flex items-center gap-3", className)}>
      <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <ShieldCheck className="size-5" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-base font-bold tracking-normal">{APP_NAME}</span>
          <span className="block text-xs text-muted-foreground">
            Elecciones digitales
          </span>
        </span>
      )}
    </Link>
  );
}
