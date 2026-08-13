"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AppMode } from "@/components/providers/app-mode-provider";
import {
  bugTriageInputSchema,
  bugTriageSampleInput,
  type BugTriageInput,
} from "@/features/workflows/bug-triage/schema";
import { FormSection, WorkflowFormShell } from "@/features/workflows/workflow-form-shell";

const emptyInput: BugTriageInput = {
  title: "",
  affectedArea: "",
  observedBehavior: "",
  expectedBehavior: "",
  evidence: [{ value: "" }],
  settings: "",
  constraints: "",
};

export function BugTriageForm({
  onSubmitResult,
  mode,
}: {
  onSubmitResult: (input: BugTriageInput) => Promise<void> | void;
  mode: AppMode;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BugTriageInput>({
    resolver: zodResolver(bugTriageInputSchema),
    defaultValues: emptyInput,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "evidence" });

  return (
    <WorkflowFormShell mode={mode}>
      <form onSubmit={handleSubmit(onSubmitResult)} noValidate>
        <FormSection title="Issue" description="Describe the observed problem without diagnosing it yet.">
          <Field id="bug-title" label="Issue title" error={errors.title?.message}>
            <Input
              id="bug-title"
              placeholder="e.g. CSV export stalls on larger reports"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "bug-title-error" : undefined}
              {...register("title")}
            />
          </Field>
          <Field id="bug-area" label="Affected area" error={errors.affectedArea?.message}>
            <Input
              id="bug-area"
              placeholder="e.g. Analytics exports"
              aria-invalid={Boolean(errors.affectedArea)}
              aria-describedby={errors.affectedArea ? "bug-area-error" : undefined}
              {...register("affectedArea")}
            />
          </Field>
          <Field
            id="bug-observed"
            label="Observed behavior"
            description="What happened, and under what conditions?"
            error={errors.observedBehavior?.message}
          >
            <Textarea
              id="bug-observed"
              placeholder="Describe what the user or system did..."
              aria-invalid={Boolean(errors.observedBehavior)}
              aria-describedby={
                errors.observedBehavior ? "bug-observed-description bug-observed-error" : "bug-observed-description"
              }
              {...register("observedBehavior")}
            />
          </Field>
        </FormSection>

        <FormSection title="Expectation">
          <Field
            id="bug-expected"
            label="Expected behavior"
            error={errors.expectedBehavior?.message}
          >
            <Textarea
              id="bug-expected"
              placeholder="Describe the correct outcome..."
              aria-invalid={Boolean(errors.expectedBehavior)}
              aria-describedby={errors.expectedBehavior ? "bug-expected-error" : undefined}
              {...register("expectedBehavior")}
            />
          </Field>
        </FormSection>

        <FormSection
          title="Evidence"
          description="Add only repeatable observations, logs, or comparisons you already know."
        >
          <div className="grid gap-3">
            {fields.map((field, index) => {
              const fieldError = errors.evidence?.[index]?.value?.message;
              const id = `bug-evidence-${index}`;
              return (
                <div key={field.id} className="grid grid-cols-[1fr_auto] items-start gap-2">
                  <Field
                    id={id}
                    label={`Evidence ${index + 1}`}
                    error={fieldError}
                    className="min-w-0"
                  >
                    <Input
                      id={id}
                      placeholder="e.g. Smaller exports finish successfully"
                      aria-invalid={Boolean(fieldError)}
                      aria-describedby={fieldError ? `${id}-error` : undefined}
                      {...register(`evidence.${index}.value`)}
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-6"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    aria-label={`Remove evidence ${index + 1}`}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            variant="quiet"
            size="sm"
            className="w-fit"
            onClick={() => append({ value: "" })}
          >
            <Plus aria-hidden="true" className="size-4" /> Add evidence
          </Button>
        </FormSection>

        <details className="group border-b border-border">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 text-sm font-bold text-foreground marker:hidden sm:px-6">
            Advanced context
            <span aria-hidden="true" className="text-lg font-normal text-foreground-soft group-open:rotate-45">
              +
            </span>
          </summary>
          <div className="grid gap-5 px-5 pb-6 sm:px-6">
            <Field id="bug-settings" label="Relevant settings" optional>
              <Input
                id="bug-settings"
                placeholder="Feature flags, filters, browser, environment..."
                {...register("settings")}
              />
            </Field>
            <Field id="bug-constraints" label="Constraints" optional>
              <Textarea
                id="bug-constraints"
                placeholder="Safety boundaries or environments to avoid..."
                {...register("constraints")}
              />
            </Field>
          </div>
        </details>

        <div className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => reset(emptyInput)} disabled={isSubmitting}>
              <RotateCcw aria-hidden="true" className="size-4" /> Reset
            </Button>
            <Button type="button" variant="secondary" onClick={() => reset(bugTriageSampleInput)} disabled={isSubmitting}>
              Load sample
            </Button>
          </div>
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Sparkles aria-hidden="true" className="size-4" />
            )}
            {isSubmitting ? "Submitting…" : mode === "live" ? "Run live triage" : "Run demo triage"}
          </Button>
        </div>
      </form>
    </WorkflowFormShell>
  );
}
