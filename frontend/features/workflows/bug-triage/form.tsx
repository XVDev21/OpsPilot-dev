"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { AppMode } from "@/components/providers/app-mode-provider";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  bugTriageInputSchema,
  bugTriageSampleInput,
  type BugTriageInput,
} from "@/features/workflows/bug-triage/schema";
import { CollaboratorSelect } from "@/features/workflows/collaborator-select";
import type { WorkflowInputMode } from "@/features/workflows/shared-schema";
import {
  FormSection,
  WorkflowFormShell,
  WorkflowInputModeSwitch,
} from "@/features/workflows/workflow-form-shell";

const emptyInput: BugTriageInput = {
  inputMode: "simple",
  title: "",
  affectedArea: "",
  observedBehavior: "",
  expectedBehavior: "",
  evidence: [],
  settings: "",
  constraints: "",
  triageOwnerId: "",
};

export function BugTriageForm({
  onSubmitResult,
  mode,
}: {
  onSubmitResult: (input: BugTriageInput) => Promise<void> | void;
  mode: AppMode;
}) {
  const [inputMode, setInputMode] = useState<WorkflowInputMode>("simple");
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BugTriageInput>({
    resolver: zodResolver(bugTriageInputSchema),
    defaultValues: emptyInput,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "evidence" });

  function changeInputMode(nextMode: WorkflowInputMode) {
    setInputMode(nextMode);
    setValue("inputMode", nextMode, { shouldDirty: true });
  }

  function resetForm() {
    reset(emptyInput);
    setInputMode("simple");
  }

  function loadSample() {
    reset(bugTriageSampleInput);
    setInputMode("advanced");
  }

  return (
    <WorkflowFormShell mode={mode}>
      <form onSubmit={handleSubmit(onSubmitResult)} noValidate>
        <input type="hidden" {...register("inputMode")} />
        <WorkflowInputModeSwitch value={inputMode} onChange={changeInputMode} />

        <FormSection title="Issue" description="Start with the symptom. OpsPilot will keep diagnosis separate from evidence.">
          <Field id="bug-title" label="Issue title" error={errors.title?.message}>
            <Input
              id="bug-title"
              placeholder="e.g. CSV export stalls on larger reports"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "bug-title-error" : undefined}
              {...register("title")}
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
              className="min-h-40"
              placeholder="Describe what the user or system did..."
              aria-invalid={Boolean(errors.observedBehavior)}
              aria-describedby={
                errors.observedBehavior
                  ? "bug-observed-description bug-observed-error"
                  : "bug-observed-description"
              }
              {...register("observedBehavior")}
            />
          </Field>
        </FormSection>

        {inputMode === "advanced" ? (
          <>
            <FormSection
              title="Expected outcome"
              description="These details help separate configuration friction from a probable product defect."
            >
              <Field id="bug-area" label="Affected area" optional>
                <Input
                  id="bug-area"
                  placeholder="e.g. Analytics exports"
                  {...register("affectedArea")}
                />
              </Field>
              <Field id="bug-expected" label="Expected behavior" optional>
                <Textarea
                  id="bug-expected"
                  placeholder="Describe the correct outcome..."
                  {...register("expectedBehavior")}
                />
              </Field>
            </FormSection>

            <FormSection
              title="Evidence"
              description="Add repeatable observations, logs, or comparisons. More concrete evidence can increase confidence."
            >
              {fields.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border-strong p-4 text-sm leading-6 text-foreground-muted">
                  No evidence points yet. The result will stay conservative and route the issue for more investigation.
                </p>
              ) : (
                <div className="grid gap-3">
                  {fields.map((field, index) => {
                    const fieldError = errors.evidence?.[index]?.value?.message;
                    const id = `bug-evidence-${index}`;
                    return (
                      <div key={field.id} className="grid grid-cols-[1fr_auto] items-start gap-2">
                        <Field id={id} label={`Evidence ${index + 1}`} error={fieldError} className="min-w-0">
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
                          aria-label={`Remove evidence ${index + 1}`}
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              <Button type="button" variant="quiet" size="sm" className="w-fit" onClick={() => append({ value: "" })}>
                <Plus aria-hidden="true" className="size-4" /> Add evidence
              </Button>
            </FormSection>

            <FormSection
              title="Routing and guardrails"
              description="Choose a sample review owner and record conditions the investigation should respect."
            >
              <CollaboratorSelect
                id="bug-triage-owner"
                label="Triage owner"
                description="The selected sample collaborator will be echoed as the review owner, not treated as a real account."
                registration={register("triageOwnerId")}
              />
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
            </FormSection>
          </>
        ) : null}

        <div className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={resetForm} disabled={isSubmitting}>
              <RotateCcw aria-hidden="true" className="size-4" /> Reset
            </Button>
            <Button type="button" variant="secondary" onClick={loadSample} disabled={isSubmitting}>
              Load advanced sample
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
