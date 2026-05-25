"use client";

import * as React from "react";
import { Toaster } from "sonner";


import { AuthProvider } from "@/components/providers/auth-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
      <Toaster richColors closeButton position="top-right" />
    </ThemeProvider>
  );
}
