"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SheetProps {
  trigger: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  side?: "left" | "right";
  closeLabel?: string;
}

export function Sheet({
  trigger,
  title,
  description,
  children,
  side = "right",
  closeLabel = "Close navigation",
}: SheetProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#080d18]/55 backdrop-blur-[2px] data-[state=closed]:animate-[fade-out_180ms_ease-out] data-[state=open]:animate-[fade-in_180ms_ease-out]" />
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 z-50 flex w-[min(88vw,22rem)] flex-col border-border bg-surface-raised p-5 shadow-[var(--shadow-panel)] focus:outline-none data-[state=closed]:animate-[sheet-out_180ms_ease-out] data-[state=open]:animate-[sheet-in_240ms_cubic-bezier(0.16,1,0.3,1)]",
            side === "right" ? "right-0 border-l" : "left-0 border-r",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <Dialog.Title className="text-base font-bold text-foreground">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm leading-5 text-foreground-muted">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] text-foreground-muted transition-colors hover:bg-surface-soft hover:text-foreground"
              aria-label={closeLabel}
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
