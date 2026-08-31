"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ImagePlus,
  LoaderCircle,
  MessageSquareText,
  Send,
  AtSign,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { browserApi } from "@/lib/api/browser-client";
import type { CaseUpdate, OperationsCaseDetail } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const updateTypes = [
  ["progress", "Progress note"],
  ["blocker", "Blocker"],
  ["decision", "Decision"],
  ["clarification", "Clarification"],
  ["resolution", "Resolution proposal"],
] as const;
const MAX_UPDATE_MENTIONS = 12;

function updateTone(type: CaseUpdate["type"]) {
  if (type === "blocker") return "warning" as const;
  if (type === "resolution" || type === "verification") return "success" as const;
  return "primary" as const;
}

export function CaseUpdatesPanel({
  caseId,
  item,
  onChanged,
}: {
  caseId: string;
  item: OperationsCaseDetail;
  onChanged: () => Promise<void>;
}) {
  const [type, setType] = useState<CaseUpdate["type"]>("progress");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [verificationResult, setVerificationResult] = useState<"passed" | "failed">("passed");
  const [mentionedMemberIds, setMentionedMemberIds] = useState<string[]>([]);
  const members = useQuery({
    queryKey: ["workspace-members"],
    queryFn: browserApi.listWorkspaceMembers,
  });
  const mentionableMembers =
    members.data?.items.filter(
      (member) => member.linkedAccount && member.isActive && !member.isSample,
    ) ?? [];
  const post = useMutation({
    mutationFn: async () => {
      const update = await browserApi.createCaseUpdate(caseId, {
        clientRequestId: crypto.randomUUID(),
        type,
        body,
        ...(type === "verification" ? { verificationResult } : {}),
        ...(mentionedMemberIds.length ? { mentionedMemberIds } : {}),
      });
      if (file) await browserApi.uploadCaseUpdateImage(caseId, update.id, file);
      return update;
    },
    onSuccess: async () => {
      setBody("");
      setFile(null);
      setMentionedMemberIds([]);
      await onChanged();
    },
  });

  return (
    <section
      className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-raised shadow-[var(--shadow-sm)]"
      aria-labelledby="case-updates-heading"
    >
      <div className="grid xl:grid-cols-[22rem_minmax(0,1fr)]">
        <form
          className="border-b border-border bg-surface-soft p-5 sm:p-6 xl:border-r xl:border-b-0"
          onSubmit={(event) => {
            event.preventDefault();
            post.mutate();
          }}
        >
          <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
            Authenticated update
          </p>
          <h2 id="case-updates-heading" className="mt-2 text-xl font-bold text-foreground">
            Move the case forward
          </h2>
          <p className="mt-2 text-xs leading-5 text-foreground-muted">
            Progress is append-only and attributed to your workspace account. Sample assignees
            cannot author updates.
          </p>
          <label htmlFor="case-update-type" className="mt-5 block text-xs font-bold text-foreground">
            Update type
          </label>
          <Select
            id="case-update-type"
            className="mt-1.5"
            value={type}
            onChange={(event) => setType(event.target.value as CaseUpdate["type"])}
          >
            {updateTypes.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
            {item.status === "verification" ? <option value="verification">Verification result</option> : null}
          </Select>
          {type === "verification" ? (
            <Select
              aria-label="Verification result"
              className="mt-2"
              value={verificationResult}
              onChange={(event) => setVerificationResult(event.target.value as "passed" | "failed")}
            >
              <option value="passed">Passed — resolve case</option>
              <option value="failed">Failed — return to delivery</option>
            </Select>
          ) : null}
          <Textarea
            className="mt-3 min-h-32"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="What changed, what remains, and what should the next person know?"
            minLength={3}
            maxLength={6000}
            required
          />
          {mentionableMembers.length ? (
            <fieldset className="mt-3">
              <legend className="flex items-center gap-2 text-xs font-bold text-foreground">
                <AtSign aria-hidden="true" className="size-4 text-primary" /> Notify teammates
              </legend>
              <p className="mt-1 text-[0.6875rem] leading-5 text-foreground-soft">
                Choose up to {MAX_UPDATE_MENTIONS} account-linked members who should receive this
                update.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {mentionableMembers.map((member) => {
                  const selected = mentionedMemberIds.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      aria-pressed={selected}
                      disabled={!selected && mentionedMemberIds.length >= MAX_UPDATE_MENTIONS}
                      onClick={() =>
                        setMentionedMemberIds((current) =>
                          selected
                            ? current.filter((value) => value !== member.id)
                            : [...current, member.id],
                        )
                      }
                      className={cn(
                        "min-h-10 rounded-xl border px-3 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                        selected
                          ? "border-primary/35 bg-surface-accent text-primary"
                          : "border-border bg-surface-raised text-foreground-muted hover:border-primary/25",
                      )}
                    >
                      @{member.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
          <label htmlFor="case-update-image" className="mt-3 flex items-center gap-2 text-xs font-bold text-foreground">
            <ImagePlus aria-hidden="true" className="size-4 text-primary" /> Supporting image (optional)
          </label>
          <Input
            id="case-update-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="mt-1.5 file:mr-3 file:text-xs"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <Button type="submit" className="mt-4 w-full" disabled={post.isPending || body.trim().length < 3}>
            {post.isPending ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Send aria-hidden="true" className="size-4" />
            )}
            Post update
          </Button>
          {post.isError ? (
            <p role="alert" className="mt-3 text-xs leading-5 text-danger">
              The update was not posted. Your case record was not changed.
            </p>
          ) : null}
        </form>

        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">Work status</p>
              <h3 className="mt-2 text-lg font-bold text-foreground">Delivery journal</h3>
            </div>
            <Badge tone={item.updates.length ? "primary" : "neutral"}>{item.updates.length} updates</Badge>
          </div>
          <div className="mt-5 grid gap-3">
            {item.updates.map((update) => (
              <article key={update.id} className="border-l-2 border-primary/40 py-1 pl-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={updateTone(update.type)}>{update.type}</Badge>
                  <span className="text-xs font-bold text-foreground">
                    {update.author?.name ?? "Former workspace member"}
                  </span>
                  <time className="ml-auto flex items-center gap-1 font-mono text-[0.625rem] text-foreground-soft" dateTime={update.createdAt}>
                    <Clock3 aria-hidden="true" className="size-3" />
                    {new Date(update.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground-muted">{update.body}</p>
                {update.mentionedMembers.length ? (
                  <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-foreground-soft">
                    <AtSign aria-hidden="true" className="size-3.5 text-primary" />
                    Notified {update.mentionedMembers.map((member) => member.name).join(", ")}
                  </p>
                ) : null}
                {update.verificationResult ? (
                  <p className="mt-2 flex items-center gap-2 text-xs font-bold text-foreground">
                    {update.verificationResult === "passed" ? <CheckCircle2 className="size-4 text-success" /> : <AlertTriangle className="size-4 text-warning" />}
                    Verification {update.verificationResult}
                  </p>
                ) : null}
                {update.attachments.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {update.attachments.map((attachment) => (
                      <div key={attachment.id} className="relative h-28 w-40 overflow-hidden rounded-xl border border-border bg-surface-accent">
                        <Image
                          src={`/api/backend/cases/${caseId}/updates/attachments/${attachment.id}/content`}
                          alt={attachment.originalFilename}
                          fill
                          sizes="160px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
            {!item.updates.length ? (
              <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-border-strong p-6 text-center">
                <div>
                  <MessageSquareText aria-hidden="true" className="mx-auto size-6 text-primary" />
                  <p className="mt-3 text-sm font-bold text-foreground">No delivery signal yet</p>
                  <p className="mt-1 max-w-md text-xs leading-5 text-foreground-muted">
                    Post the first progress note, decision, blocker, or resolution proposal. It will
                    also appear in Case Activity.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
