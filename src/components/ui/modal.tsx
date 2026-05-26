"use client";

import { AlertTriangle, Info, X } from "lucide-react";
import { useCallback, useEffect, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type ModalVariant = "confirm" | "info" | "destructive";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ModalVariant;
  loading?: boolean;
}

export function Modal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "confirm",
  loading = false,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    // Auto-focus confirm button for keyboard accessibility
    confirmRef.current?.focus();
    // Prevent body scroll
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const isInfo = variant === "info";
  const isDestructive = variant === "destructive";

  const Icon = isDestructive ? AlertTriangle : Info;
  const iconBg = isDestructive
    ? "bg-destructive/10 text-destructive"
    : "bg-primary/10 text-primary";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-xl border bg-card p-6 shadow-2xl animate-in zoom-in-95 fade-in duration-200">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-ring"
          aria-label="Cerrar"
        >
          <X className="size-4" />
        </button>

        {/* Icon */}
        <div className="mb-4 flex justify-center">
          <div
            className={`grid size-14 place-items-center rounded-full ${iconBg}`}
          >
            <Icon className="size-7" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center">
          <h2
            id="modal-title"
            className="text-lg font-semibold leading-tight text-card-foreground"
          >
            {title}
          </h2>
          {description && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
          {children ? <div className="mt-4 text-left">{children}</div> : null}
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          {!isInfo && (
            <Button type="button" variant="outline" onClick={onClose}>
              {cancelLabel}
            </Button>
          )}
          <Button
            ref={confirmRef}
            type="button"
            variant={isDestructive ? "destructive" : "default"}
            disabled={loading}
            onClick={() => {
              if (onConfirm) {
                onConfirm();
              } else {
                onClose();
              }
            }}
          >
            {isInfo ? "Aceptar" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
