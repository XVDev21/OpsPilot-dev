"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  trigger,
  pending = false,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  trigger: ReactNode;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#07101f]/58 backdrop-blur-sm data-[state=closed]:animate-[fade-out_160ms_ease-in] data-[state=open]:animate-[fade-in_180ms_ease-out] motion-reduce:animate-none" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(calc(100%-1.5rem),28rem)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-panel)] sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger"><AlertTriangle aria-hidden="true" className="size-5" /></span>
            <div>
              <Dialog.Title className="text-lg font-bold text-foreground">{title}</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 text-foreground-muted">{description}</Dialog.Description>
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Dialog.Close asChild><Button type="button" variant="secondary" disabled={pending}>Cancel</Button></Dialog.Close>
            <Button type="button" variant="danger" disabled={pending} onClick={onConfirm}>{pending ? "Deleting…" : confirmLabel}</Button>
          </div>
          <Dialog.Close asChild>
            <button type="button" aria-label="Close confirmation" className="absolute top-3 right-3 grid size-11 place-items-center rounded-xl text-foreground-muted hover:bg-surface-soft hover:text-foreground"><X aria-hidden="true" className="size-4" /></button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
