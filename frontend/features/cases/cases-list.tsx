"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CircleDot,
  FileSearch,
  FolderKanban,
  Lightbulb,
  LoaderCircle,
  Plus,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  caseDispositionLabels,
  caseIntentLabels,
  casePublicationLabels,
  caseStatusLabels,
  caseStatuses,
  formatCaseDate,
} from "@/features/cases/presentation";
import { browserApi } from "@/lib/api/browser-client";
import type { CaseIntent } from "@/lib/api/types";

type CaseDraft = {
  intent: CaseIntent;
  title: string;
  description: string;
  affectedArea: string;
  expectedOutcome: string;
  evidence: string;
  environmentContext: string;
  settingsContext: string;
  constraints: string;
};

const emptyDraft: CaseDraft = {
  intent: "issue",
  title: "",
  description: "",
  affectedArea: "",
  expectedOutcome: "",
  evidence: "",
  environmentContext: "",
  settingsContext: "",
  constraints: "",
};

const intentOptions: Array<{
  value: CaseIntent;
  icon: typeof FileSearch;
  description: string;
}> = [
  {
    value: "issue",
    icon: FileSearch,
    description:
      "Assess whether the report is a defect, configuration issue, or needs evidence.",
  },
  {
    value: "clarification",
    icon: Lightbulb,
    description:
      "Capture a product or process question without forcing a defect classification.",
  },
  {
    value: "enhancement",
    icon: Sparkles,
    description:
      "Propose additional development and publish it without running bug triage.",
  },
];

export function CasesList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<CaseDraft>(emptyDraft);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [status, setStatus] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const members = useQuery({
    queryKey: ["workspace-members"],
    queryFn: browserApi.listWorkspaceMembers,
  });
  const filters = {
    ...(deferredSearch ? { search: deferredSearch } : {}),
    ...(status ? { status } : {}),
    ...(assigneeId ? { assigneeId } : {}),
  };
  const cases = useQuery({
    queryKey: ["cases", filters],
    queryFn: () => browserApi.listCases(filters),
  });
  const create = useMutation({
    mutationFn: () =>
      browserApi.createCase({
        intent: draft.intent,
        title: draft.title,
        description: draft.description,
        affectedArea: draft.affectedArea,
        expectedOutcome: draft.expectedOutcome,
        environmentContext: draft.environmentContext,
        settingsContext: draft.settingsContext,
        constraints: draft.constraints,
        evidenceNotes: draft.evidence
          .split("\n")
          .map((value) => value.trim())
          .filter((value) => value.length >= 3),
      }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
      setDraft(emptyDraft);
      router.push(`/app/cases/${created.id}`);
    },
  });

  return (
    <div className="grid gap-7">
      <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-raised shadow-[var(--shadow-panel)]">
        <div className="grid xl:grid-cols-[minmax(20rem,0.72fr)_minmax(36rem,1.28fr)]">
          <div className="paper-grid border-b border-border p-5 sm:p-7 xl:border-r xl:border-b-0">
            <Badge tone="primary">Case-first intake</Badge>
            <h1 className="mt-5 max-w-xl text-balance text-3xl font-bold tracking-[-0.045em] text-foreground sm:text-4xl">
              Capture the situation before deciding what it is
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-foreground-muted sm:text-base sm:leading-7">
              Every intake begins as a private draft. Add evidence, request a
              versioned AI assessment when it helps, then publish or assign the
              case on your terms.
            </p>
            <ol className="mt-8 grid gap-3">
              {[
                [
                  "01",
                  "Open a draft",
                  "Choose the intent and preserve the original report.",
                ],
                [
                  "02",
                  "Assess",
                  "Compare evidence-bound model results without overwriting history.",
                ],
                [
                  "03",
                  "Publish",
                  "Route the case even when the AI recommends configuration guidance.",
                ],
              ].map(([number, title, text]) => (
                <li
                  key={number}
                  className="grid grid-cols-[2.5rem_1fr] gap-3 rounded-2xl border border-border bg-surface-raised/88 p-4"
                >
                  <span className="font-mono text-xs font-bold text-primary">
                    {number}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-foreground">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-foreground-muted">
                      {text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <form
            className="grid content-start gap-5 p-5 sm:p-7"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-accent text-primary">
                <Plus aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
                  New draft
                </p>
                <h2 className="mt-1 text-xl font-bold text-foreground">
                  Open an Operations Case
                </h2>
              </div>
            </div>

            <fieldset>
              <legend className="text-xs font-bold text-foreground">
                What is the intent?
              </legend>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                {intentOptions.map((option) => {
                  const selected = draft.intent === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-2xl border p-3 transition-colors ${
                        selected
                          ? "border-primary/45 bg-surface-accent"
                          : "border-border bg-surface-soft hover:border-primary/25"
                      }`}
                    >
                      <input
                        type="radio"
                        name="case-intent"
                        value={option.value}
                        checked={selected}
                        onChange={() =>
                          setDraft((current) => ({
                            ...current,
                            intent: option.value,
                          }))
                        }
                        className="sr-only"
                      />
                      <option.icon
                        aria-hidden="true"
                        className="size-4 text-primary"
                      />
                      <span className="mt-2 block text-xs font-bold text-foreground">
                        {caseIntentLabels[option.value]}
                      </span>
                      <span className="mt-1 block text-[0.6875rem] leading-4 text-foreground-muted">
                        {option.description}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_15rem]">
              <div>
                <label
                  htmlFor="case-title"
                  className="text-xs font-bold text-foreground"
                >
                  Case title
                </label>
                <Input
                  id="case-title"
                  className="mt-1.5"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Holiday field is missing"
                  required
                  minLength={3}
                  maxLength={200}
                />
              </div>
              <div>
                <label
                  htmlFor="case-area"
                  className="text-xs font-bold text-foreground"
                >
                  Affected area
                </label>
                <Input
                  id="case-area"
                  className="mt-1.5"
                  value={draft.affectedArea}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      affectedArea: event.target.value,
                    }))
                  }
                  placeholder="Payroll entry"
                  maxLength={160}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="case-description"
                  className="text-xs font-bold text-foreground"
                >
                  What happened?
                </label>
                <Textarea
                  id="case-description"
                  className="mt-1.5 min-h-32"
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Describe the reported behavior, where it occurred, and who is affected."
                  required
                  minLength={12}
                  maxLength={6000}
                />
              </div>
              <div>
                <label
                  htmlFor="case-expected"
                  className="text-xs font-bold text-foreground"
                >
                  What should happen?
                </label>
                <Textarea
                  id="case-expected"
                  className="mt-1.5 min-h-32"
                  value={draft.expectedOutcome}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      expectedOutcome: event.target.value,
                    }))
                  }
                  placeholder="Describe the expected user-visible outcome."
                  maxLength={3000}
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="case-evidence"
                className="text-xs font-bold text-foreground"
              >
                Known evidence{" "}
                <span className="font-normal text-foreground-soft">
                  — one item per line
                </span>
              </label>
              <Textarea
                id="case-evidence"
                className="mt-1.5 min-h-24"
                value={draft.evidence}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    evidence: event.target.value,
                  }))
                }
                placeholder={
                  "Holiday field is absent for the payroll user\nThe same field appears for an administrator"
                }
                maxLength={6000}
              />
            </div>

            <details className="rounded-2xl border border-border bg-surface-soft p-4">
              <summary className="cursor-pointer text-xs font-bold text-foreground">
                Advanced context for a stronger assessment
              </summary>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <label
                    htmlFor="case-environment"
                    className="text-[0.6875rem] font-bold text-foreground"
                  >
                    Environment
                  </label>
                  <Textarea
                    id="case-environment"
                    className="mt-1.5 min-h-24 text-xs"
                    value={draft.environmentContext}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        environmentContext: event.target.value,
                      }))
                    }
                    placeholder="Browser, role, tenant, version"
                    maxLength={2000}
                  />
                </div>
                <div>
                  <label
                    htmlFor="case-settings"
                    className="text-[0.6875rem] font-bold text-foreground"
                  >
                    Known settings
                  </label>
                  <Textarea
                    id="case-settings"
                    className="mt-1.5 min-h-24 text-xs"
                    value={draft.settingsContext}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        settingsContext: event.target.value,
                      }))
                    }
                    placeholder="Relevant toggles or permissions"
                    maxLength={2000}
                  />
                </div>
                <div>
                  <label
                    htmlFor="case-constraints"
                    className="text-[0.6875rem] font-bold text-foreground"
                  >
                    Constraints
                  </label>
                  <Textarea
                    id="case-constraints"
                    className="mt-1.5 min-h-24 text-xs"
                    value={draft.constraints}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        constraints: event.target.value,
                      }))
                    }
                    placeholder="Safety, access, or timing limits"
                    maxLength={2000}
                  />
                </div>
              </div>
            </details>

            {create.isError ? (
              <p role="alert" className="text-xs text-danger">
                The draft could not be opened. Your input is still here.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <FolderKanban aria-hidden="true" className="size-4" />
                )}
                Open private draft
              </Button>
              <span className="text-xs text-foreground-soft">
                No AI request or publication happens yet.
              </span>
            </div>
          </form>
        </div>
      </section>

      <section aria-labelledby="case-register-heading">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
              Case register
            </p>
            <h2
              id="case-register-heading"
              className="mt-2 text-2xl font-bold tracking-[-0.03em] text-foreground"
            >
              Workspace decisions and delivery
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(13rem,1fr)_11rem_13rem]">
            <label className="relative">
              <span className="sr-only">Search cases</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-foreground-soft"
              />
              <Input
                className="pl-10"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search cases"
              />
            </label>
            <Select
              aria-label="Filter by case state"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All states</option>
              {caseStatuses.map((value) => (
                <option key={value} value={value}>
                  {caseStatusLabels[value]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter by assignee"
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
            >
              <option value="">All owners</option>
              {members.data?.items.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {cases.isPending ? (
          <p
            role="status"
            className="mt-6 flex items-center gap-2 text-sm text-foreground-muted"
          >
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin text-primary motion-reduce:animate-none"
            />{" "}
            Loading case register…
          </p>
        ) : cases.isError ? (
          <p role="alert" className="mt-6 text-sm text-danger">
            Cases could not be loaded.
          </p>
        ) : cases.data.items.length ? (
          <div className="mt-5 grid gap-3">
            {cases.data.items.map((item) => (
              <Link
                key={item.id}
                href={`/app/cases/${item.id}`}
                className="group grid gap-4 rounded-2xl border border-border bg-surface-raised p-4 shadow-[var(--shadow-sm)] transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[var(--shadow-panel)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5 motion-reduce:transform-none"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary">
                      {item.key}
                    </span>
                    <Badge
                      tone={
                        item.publicationState === "published"
                          ? "success"
                          : "neutral"
                      }
                    >
                      {casePublicationLabels[item.publicationState]}
                    </Badge>
                    <Badge>{caseIntentLabels[item.intent]}</Badge>
                    <Badge>{caseDispositionLabels[item.disposition]}</Badge>
                  </div>
                  <h3 className="mt-3 truncate text-base font-bold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-foreground-muted">
                    {item.summary ||
                      "No applied assessment yet. Open the case to add evidence or publish it."}
                  </p>
                </div>
                <div className="grid min-w-56 gap-2 text-xs text-foreground-muted sm:justify-items-end">
                  <span className="flex items-center gap-2">
                    <UserRound
                      aria-hidden="true"
                      className="size-3.5 text-primary"
                    />{" "}
                    {item.assignee?.name ?? "Unassigned"}
                  </span>
                  <span className="flex items-center gap-2">
                    <CalendarDays
                      aria-hidden="true"
                      className="size-3.5 text-primary"
                    />{" "}
                    {formatCaseDate(item.dueDate)}
                  </span>
                  <span className="flex items-center gap-2">
                    {caseStatusLabels[item.status]}{" "}
                    <ArrowRight
                      aria-hidden="true"
                      className="size-3.5 transition-transform group-hover:translate-x-1 motion-reduce:transform-none"
                    />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[var(--radius-panel)] border border-dashed border-border-strong bg-surface-soft p-8 text-center">
            <CircleDot
              aria-hidden="true"
              className="mx-auto size-6 text-primary"
            />
            <h3 className="mt-4 text-base font-bold text-foreground">
              No cases match this view
            </h3>
            <p className="mt-2 text-sm text-foreground-muted">
              Clear the filters or open the first private draft above.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
