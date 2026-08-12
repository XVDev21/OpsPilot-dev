"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  meetingActionsInputSchema,
  meetingActionsSampleInput,
  type MeetingActionsInput,
} from "@/features/workflows/meeting-actions/schema";
import { FormSection, WorkflowFormShell } from "@/features/workflows/workflow-form-shell";

const emptyInput: MeetingActionsInput = {
  title: "",
  notes: "",
  participants: [],
  date: "",
};

export function MeetingActionsForm({
  onSubmitResult,
}: {
  onSubmitResult: (input: MeetingActionsInput) => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MeetingActionsInput>({
    resolver: zodResolver(meetingActionsInputSchema),
    defaultValues: emptyInput,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "participants" });

  return (
    <WorkflowFormShell>
      <form onSubmit={handleSubmit(onSubmitResult)} noValidate>
        <FormSection title="Meeting" description="Paste working notes as they are; no prompt formatting needed.">
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
            description="For this deterministic demo, prefixes such as Decision:, Action:, and Open question: make extraction visible and repeatable."
            error={errors.notes?.message}
          >
            <Textarea
              id="meeting-notes"
              className="min-h-48"
              placeholder="Decision: ...&#10;Action: Name will ...&#10;Open question: ..."
              aria-invalid={Boolean(errors.notes)}
              aria-describedby={errors.notes ? "meeting-notes-description meeting-notes-error" : "meeting-notes-description"}
              {...register("notes")}
            />
          </Field>
        </FormSection>

        <FormSection title="Context" description="Owners and deadlines appear only when supported by the input.">
          <Field id="meeting-date" label="Meeting date" optional>
            <Input id="meeting-date" type="date" {...register("date")} />
          </Field>
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Participants</h3>
                <p className="mt-1 text-xs text-foreground-muted">Optional; used only to support explicit owners.</p>
              </div>
              <Button type="button" variant="quiet" size="sm" onClick={() => append({ value: "" })}>
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

        <div className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => reset(emptyInput)}>
              <RotateCcw aria-hidden="true" className="size-4" /> Reset
            </Button>
            <Button type="button" variant="secondary" onClick={() => reset(meetingActionsSampleInput)}>
              Load sample
            </Button>
          </div>
          <Button type="submit" size="lg">
            <Sparkles aria-hidden="true" className="size-4" /> Run demo extraction
          </Button>
        </div>
      </form>
    </WorkflowFormShell>
  );
}
