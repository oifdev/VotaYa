"use client";

import * as React from "react";
import { Toaster } from "sonner";


import { ThemeProvider } from "@/components/providers/theme-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
        {children}
      <Toaster richColors closeButton position="top-right" />
    </ThemeProvider>
  );
}