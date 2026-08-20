"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { AppMode } from "@/components/providers/app-mode-provider";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CollaboratorSelect } from "@/features/workflows/collaborator-select";
import type { WorkflowInputMode } from "@/features/workflows/shared-schema";
import {
  statusUpdateInputSchema,
  statusUpdateSampleInput,
  type StatusUpdateInput,
} from "@/features/workflows/status-update/schema";
import {
  FormSection,
  WorkflowFormShell,
  WorkflowInputModeSwitch,
} from "@/features/workflows/workflow-form-shell";

const emptyInput: StatusUpdateInput = {
  inputMode: "simple",
  notes: "",
  audience: "team",
  format: "daily",
  authorId: "",
};

export function StatusUpdateForm({
  onSubmitResult,
  mode,
}: {
  onSubmitResult: (input: StatusUpdateInput) => Promise<void> | void;
  mode: AppMode;
}) {
  const [inputMode, setInputMode] = useState<WorkflowInputMode>("simple");
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<StatusUpdateInput>({
    resolver: zodResolver(statusUpdateInputSchema),
    defaultValues: emptyInput,
  });

  function changeInputMode(nextMode: WorkflowInputMode) {
    setInputMode(nextMode);
    setValue("inputMode", nextMode, { shouldDirty: true });
  }

  function resetForm(values: StatusUpdateInput) {
    reset(values);
    setInputMode(values.inputMode);
  }

  return (
    <WorkflowFormShell mode={mode}>
      <form onSubmit={handleSubmit(onSubmitResult)} noValidate>
        <input type="hidden" {...register("inputMode")} />
        <WorkflowInputModeSwitch value={inputMode} onChange={changeInputMode} />

        <FormSection title="Work notes" description="Capture progress as fragments; the result handles presentation.">
          <Field
            id="status-notes"
            label="Rough notes"
            description={
              mode === "demo"
                ? "For predictable Demo Mode grouping, use Completed:, In progress:, Blocked:, and Next: when helpful."
                : "Use Completed:, In progress:, Blocked:, and Next: when those labels clarify your rough notes."
            }
            error={errors.notes?.message}
          >
            <Textarea
              id="status-notes"
              className="min-h-56"
              placeholder="Completed: ...&#10;In progress: ...&#10;Blocked: ...&#10;Next: ..."
              aria-invalid={Boolean(errors.notes)}
              aria-describedby={errors.notes ? "status-notes-description status-notes-error" : "status-notes-description"}
              {...register("notes")}
            />
          </Field>
        </FormSection>

        {inputMode === "advanced" ? (
          <FormSection
            title="Delivery and authorship"
            description="Shape the message for its audience and preserve who supplied the update."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="status-audience" label="Audience" error={errors.audience?.message}>
                <Select id="status-audience" {...register("audience")}>
                  <option value="team">Team</option>
                  <option value="manager">Manager</option>
                  <option value="stakeholders">Stakeholders</option>
                </Select>
              </Field>
              <Field id="status-format" label="Format" error={errors.format?.message}>
                <Select id="status-format" {...register("format")}>
                  <option value="daily">Daily stand-up</option>
                  <option value="manager">Manager update</option>
                  <option value="technical">Technical update</option>
                </Select>
              </Field>
            </div>
            <div className="mt-5">
              <CollaboratorSelect
                id="status-author"
                label="Update author"
                description="Optional sample profile used to preserve authorship in the generated result."
                registration={register("authorId")}
              />
            </div>
          </FormSection>
        ) : null}

        <div className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => resetForm(emptyInput)} disabled={isSubmitting}>
              <RotateCcw aria-hidden="true" className="size-4" /> Reset
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => resetForm(statusUpdateSampleInput)}
              disabled={isSubmitting}
            >
              Load sample
            </Button>
          </div>
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Sparkles aria-hidden="true" className="size-4" />
            )}
            {isSubmitting ? "Submitting…" : mode === "live" ? "Run live update" : "Run demo update"}
          </Button>
        </div>
      </form>
    </WorkflowFormShell>
  );
}
