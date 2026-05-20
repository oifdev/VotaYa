"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { adminNavItems } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-72 border-r bg-card/80 px-4 py-5 backdrop-blur lg:block">
      <Logo className="px-2" />

      <nav className="mt-8 grid gap-1">
        {adminNavItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground",
                active && "bg-accent text-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 grid gap-2 border-t pt-4">
        <ThemeToggle />
        <Button asChild variant="outline" className="justify-start">
          <Link href="/logout">
            <LogOut className="size-4" />
            Cerrar sesion
          </Link>
        </Button>
      </div>
    </aside>
  );
}
