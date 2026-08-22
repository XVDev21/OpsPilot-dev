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
import { CollaboratorSelect } from "@/features/workflows/collaborator-select";
import {
  meetingActionsInputSchema,
  meetingActionsSampleInput,
  type MeetingActionsInput,
} from "@/features/workflows/meeting-actions/schema";
import type { WorkflowInputMode } from "@/features/workflows/shared-schema";
import {
  FormSection,
  WorkflowFormShell,
  WorkflowInputModeSwitch,
} from "@/features/workflows/workflow-form-shell";

const emptyInput: MeetingActionsInput = {
  inputMode: "simple",
  title: "",
  notes: "",
  participants: [],
  date: "",
  coordinatorId: "",
};

export function MeetingActionsForm({
  onSubmitResult,
  mode,
  initialValues,
}: {
  onSubmitResult: (input: MeetingActionsInput) => Promise<void> | void;
  mode: AppMode;
  initialValues?: MeetingActionsInput;
}) {
  const [inputMode, setInputMode] = useState<WorkflowInputMode>(initialValues?.inputMode ?? "simple");
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MeetingActionsInput>({
    resolver: zodResolver(meetingActionsInputSchema),
    defaultValues: initialValues ?? emptyInput,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "participants" });

  function changeInputMode(nextMode: WorkflowInputMode) {
    setInputMode(nextMode);
    setValue("inputMode", nextMode, { shouldDirty: true });
  }

  function resetForm() {
    reset(emptyInput);
    setInputMode("simple");
  }

  function loadSample() {
    reset(meetingActionsSampleInput);
    setInputMode("advanced");
  }

  return (
    <WorkflowFormShell mode={mode}>
      <form onSubmit={handleSubmit(onSubmitResult)} noValidate>
        <input type="hidden" {...register("inputMode")} />
        <WorkflowInputModeSwitch value={inputMode} onChange={changeInputMode} />

        <FormSection title="Meeting" description="Paste the working notes as they are; no prompt formatting is required.">
          <Field id="meeting-title" label="Meeting title" error={errors.title?.message}>
            <Input
              id="meeting-title"
              placeholder="e.g. Release readiness sync"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "meeting-title-error" : undefined}
              {...register("title")}
            />
          </Field>
          <Field
            id="meeting-notes"
            label="Meeting notes"
            description={
              mode === "demo"
                ? "Prefixes such as Decision:, Action:, and Open question: keep deterministic extraction visible and repeatable."
                : "Use labels such as Decision:, Action:, and Open question: when they make the source notes clearer."
            }
            error={errors.notes?.message}
          >
            <Textarea
              id="meeting-notes"
              className="min-h-52"
              placeholder="Decision: ...&#10;Action: Name will ...&#10;Open question: ..."
              aria-invalid={Boolean(errors.notes)}
              aria-describedby={
                errors.notes
                  ? "meeting-notes-description meeting-notes-error"
                  : "meeting-notes-description"
              }
              {...register("notes")}
            />
          </Field>
        </FormSection>

        {inputMode === "advanced" ? (
          <FormSection
            title="Ownership context"
            description="Add only known participants and a sample coordinator. Owners are never invented from this directory."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="meeting-date" label="Meeting date" optional>
                <Input id="meeting-date" type="date" {...register("date")} />
              </Field>
              <CollaboratorSelect
                id="meeting-coordinator"
                label="Follow-up coordinator"
                description="Coordinates unresolved work without becoming the owner of every action item."
                registration={register("coordinatorId")}
              />
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Participants</h3>
                  <p className="mt-1 text-xs text-foreground-muted">Used only when the notes explicitly name an action owner.</p>
                </div>
                <Button type="button" variant="quiet" size="sm" className="min-h-11" onClick={() => append({ value: "" })}>
                  <Plus aria-hidden="true" className="size-4" /> Add
                </Button>
              </div>
              {fields.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border-strong p-4 text-sm text-foreground-muted">
                  No participants added. Action items can still be extracted without assigning owners.
                </p>
              ) : null}
              {fields.map((field, index) => {
                const fieldError = errors.participants?.[index]?.value?.message;
                const id = `participant-${index}`;
                return (
                  <div key={field.id} className="grid grid-cols-[1fr_auto] items-start gap-2">
                    <Field id={id} label={`Participant ${index + 1}`} error={fieldError}>
                      <Input
                        id={id}
                        placeholder="Name"
                        aria-invalid={Boolean(fieldError)}
                        aria-describedby={fieldError ? `${id}-error` : undefined}
                        {...register(`participants.${index}.value`)}
                      />
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-6"
                      onClick={() => remove(index)}
                      aria-label={`Remove participant ${index + 1}`}
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </FormSection>
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
            {isSubmitting
              ? "Submitting…"
              : mode === "live"
                ? "Run live extraction"
                : "Run demo extraction"}
          </Button>
        </div>
      </form>
    </WorkflowFormShell>
  );
}
