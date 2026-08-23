"use client";

import { useMutation } from "@tanstack/react-query";
import {
  FileText,
  ImagePlus,
  LoaderCircle,
  Paperclip,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { browserApi } from "@/lib/api/browser-client";
import type { CaseEvidence } from "@/lib/api/types";

export function CaseEvidencePanel({
  caseId,
  evidence,
  onChanged,
}: {
  caseId: string;
  evidence: CaseEvidence[];
  onChanged: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const addNote = useMutation({
    mutationFn: () => browserApi.addTextEvidence(caseId, note),
    onSuccess: async () => {
      setNote("");
      await onChanged();
    },
  });
  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Choose an image first.");
      return browserApi.uploadImageEvidence(caseId, file, caption);
    },
    onSuccess: async () => {
      setFile(null);
      setCaption("");
      await onChanged();
    },
  });
  const remove = useMutation({
    mutationFn: (evidenceId: string) =>
      browserApi.deleteEvidence(caseId, evidenceId),
    onSuccess: onChanged,
  });
  const error = addNote.error || upload.error || remove.error;

  return (
    <section
      className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6"
      aria-labelledby="case-evidence-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
            Evidence
          </p>
          <h2
            id="case-evidence-heading"
            className="mt-2 text-xl font-bold text-foreground"
          >
            Build the factual record
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-foreground-muted">
            Images are normalized, metadata is stripped, and downloads require
            the authenticated workspace session. Removing evidence excludes it
            from future runs; completed assessment snapshots stay auditable.
          </p>
        </div>
        <span className="font-mono text-xs font-bold text-foreground-soft">
          {evidence.length}/20 items
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <form
          className="rounded-2xl border border-border bg-surface-soft p-4"
          onSubmit={(event) => {
            event.preventDefault();
            addNote.mutate();
          }}
        >
          <label
            htmlFor="new-evidence-note"
            className="flex items-center gap-2 text-xs font-bold text-foreground"
          >
            <FileText aria-hidden="true" className="size-4 text-primary" /> Add
            a fact or observation
          </label>
          <Textarea
            id="new-evidence-note"
            className="mt-2 min-h-24"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Example: The field appears for administrators but not for the payroll user role."
            minLength={3}
            maxLength={3000}
            required
          />
          <Button
            type="submit"
            variant="secondary"
            className="mt-3"
            disabled={addNote.isPending}
          >
            {addNote.isPending ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Paperclip aria-hidden="true" className="size-4" />
            )}{" "}
            Add note
          </Button>
        </form>

        <form
          className="rounded-2xl border border-border bg-surface-soft p-4"
          onSubmit={(event) => {
            event.preventDefault();
            upload.mutate();
          }}
        >
          <label
            htmlFor="evidence-image"
            className="flex items-center gap-2 text-xs font-bold text-foreground"
          >
            <ImagePlus aria-hidden="true" className="size-4 text-primary" />{" "}
            Upload screenshot evidence
          </label>
          <Input
            id="evidence-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="mt-2 file:mr-3 file:text-xs"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
          />
          <Input
            aria-label="Image caption"
            className="mt-2"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="What should the reviewer notice?"
            maxLength={500}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              variant="secondary"
              disabled={upload.isPending || !file}
            >
              {upload.isPending ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin motion-reduce:animate-none"
                />
              ) : (
                <ImagePlus aria-hidden="true" className="size-4" />
              )}{" "}
              Upload image
            </Button>
            <span className="text-[0.6875rem] text-foreground-soft">
              JPEG, PNG, or WebP · up to 8 MB · 10 MP
            </span>
          </div>
        </form>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-danger/25 bg-danger/8 p-3 text-xs text-danger"
        >
          That evidence change was not saved. Check the file type or try again.
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {evidence.map((item) => (
          <article
            key={item.id}
            className="group relative overflow-hidden rounded-2xl border border-border bg-surface-soft"
          >
            {item.kind === "image" ? (
              <div className="grid grid-cols-[7rem_minmax(0,1fr)]">
                <div className="relative min-h-28 bg-surface-accent">
                  <Image
                    src={`/api/backend/cases/${caseId}/evidence/${item.id}/content`}
                    alt={
                      item.caption || item.originalFilename || "Case evidence"
                    }
                    fill
                    sizes="112px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 p-3 pr-11">
                  <p className="truncate text-xs font-bold text-foreground">
                    {item.caption || item.originalFilename}
                  </p>
                  <p className="mt-1 text-[0.6875rem] text-foreground-muted">
                    {item.width}×{item.height} ·{" "}
                    {item.byteSize
                      ? `${Math.ceil(item.byteSize / 1024)} KB`
                      : "Image"}
                  </p>
                  <p className="mt-2 truncate text-[0.625rem] text-foreground-soft">
                    {item.originalFilename}
                  </p>
                </div>
              </div>
            ) : (
              <div className="min-h-28 p-4 pr-12">
                <FileText aria-hidden="true" className="size-4 text-primary" />
                <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-foreground-muted">
                  {item.text}
                </p>
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${item.kind} evidence`}
              className="absolute top-2 right-2 opacity-80 hover:opacity-100"
              disabled={remove.isPending}
              onClick={() => remove.mutate(item.id)}
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          </article>
        ))}
        {!evidence.length ? (
          <div className="sm:col-span-2 rounded-2xl border border-dashed border-border-strong p-5 text-center">
            <p className="text-sm font-bold text-foreground">
              No supporting evidence yet
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              The case can still be published. An assessment will report lower
              evidence coverage.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
