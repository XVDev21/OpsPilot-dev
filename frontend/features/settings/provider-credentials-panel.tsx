"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  Network,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { browserApi } from "@/lib/api/browser-client";
import { ApiError } from "@/lib/api/errors";
import type {
  AIProvider,
  ProviderCredentialSummary,
} from "@/lib/api/types";

const providerInfo = {
  gemini: {
    label: "Gemini",
    icon: Sparkles,
    helpUrl: "https://ai.google.dev/gemini-api/docs/api-key",
    keyPlaceholder: "Google AI Studio API key",
  },
  openai: {
    label: "OpenAI · Personal key",
    icon: Bot,
    helpUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "OpenAI project API key",
  },
  qwen: {
    label: "Qwen",
    icon: Network,
    helpUrl: "https://www.alibabacloud.com/help/en/model-studio/get-api-key",
    keyPlaceholder: "Model Studio API key",
  },
} satisfies Record<AIProvider, {
  label: string;
  icon: typeof KeyRound;
  helpUrl: string;
  keyPlaceholder: string;
}>;

const credentialFormSchema = z.object({
  apiKey: z.string().trim().min(16, "Enter the complete provider API key.").max(2_048),
  endpointRegion: z.enum(["singapore", "us", "beijing"]),
  workspaceId: z.string().trim().max(63),
}).superRefine((value, context) => {
  if (
    value.endpointRegion !== "us" &&
    !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])$/.test(value.workspaceId)
  ) {
    context.addIssue({
      code: "custom",
      path: ["workspaceId"],
      message: "Enter the workspace ID shown in Alibaba Cloud Model Studio.",
    });
  }
});

type CredentialForm = z.infer<typeof credentialFormSchema>;

function readableError(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "OpsPilot could not update this provider credential.";
}

function ProviderCredentialCard({
  provider,
  credential,
  platformEnabled,
}: {
  provider: AIProvider;
  credential: ProviderCredentialSummary | undefined;
  platformEnabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const info = providerInfo[provider];
  const Icon = info.icon;
  const form = useForm<CredentialForm>({
    resolver: zodResolver(credentialFormSchema),
    defaultValues: {
      apiKey: "",
      endpointRegion: credential?.endpointRegion ?? (provider === "qwen" ? "singapore" : "us"),
      workspaceId: credential?.workspaceId ?? "",
    },
  });
  const region = useWatch({ control: form.control, name: "endpointRegion" });
  const saveCredential = useMutation({
    mutationFn: (values: CredentialForm) => browserApi.saveProviderCredential(provider, {
      apiKey: values.apiKey,
      ...(provider === "qwen" ? {
        endpointRegion: values.endpointRegion,
        workspaceId: values.endpointRegion === "us" ? null : values.workspaceId,
      } : {}),
    }),
    onSuccess: async () => {
      form.reset({ apiKey: "", endpointRegion: region, workspaceId: "" });
      setEditing(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["provider-credentials"] }),
        queryClient.invalidateQueries({ queryKey: ["execution-options"] }),
      ]);
    },
  });
  const deleteCredential = useMutation({
    mutationFn: () => browserApi.deleteProviderCredential(provider),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["provider-credentials"] }),
        queryClient.invalidateQueries({ queryKey: ["execution-options"] }),
      ]);
    },
  });
  const isPersonal = credential?.configured ?? false;
  const status = isPersonal ? "Personal key" : platformEnabled ? "Workspace key" : "Not configured";

  return (
    <article className="rounded-2xl border border-border bg-surface-soft p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-accent text-primary">
            <Icon aria-hidden="true" className="size-4.5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground">{info.label}</h3>
            <p className="mt-1 text-xs leading-5 text-foreground-muted">
              {isPersonal
                ? `Encrypted key fingerprint ${credential?.keyFingerprint}.`
                : platformEnabled
                  ? "Live runs currently use the OpsPilot workspace credential."
                  : "Add a personal key to enable this provider for your account."}
            </p>
          </div>
        </div>
        <Badge tone={isPersonal ? "success" : platformEnabled ? "primary" : "neutral"}>
          {status}
        </Badge>
      </div>

      {provider === "qwen" && credential?.configured ? (
        <p className="mt-3 rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs text-foreground-muted">
          {credential.endpointRegion === "us" ? "US (Virginia)" : credential.endpointRegion} endpoint
          {credential.workspaceId ? ` · workspace ${credential.workspaceId}` : ""}
        </p>
      ) : null}

      {editing ? (
        <form
          className="mt-4 grid gap-4 border-t border-border pt-4"
          onSubmit={form.handleSubmit((values) => saveCredential.mutate(values))}
        >
          <div>
            <label htmlFor={`${provider}-api-key`} className="text-xs font-bold text-foreground">
              API key
            </label>
            <Input
              id={`${provider}-api-key`}
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={info.keyPlaceholder}
              className="mt-1.5 font-mono"
              aria-invalid={Boolean(form.formState.errors.apiKey)}
              {...form.register("apiKey")}
            />
            {form.formState.errors.apiKey ? (
              <p className="mt-1.5 text-xs text-danger" role="alert">
                {form.formState.errors.apiKey.message}
              </p>
            ) : null}
          </div>

          {provider === "qwen" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="qwen-endpoint-region" className="text-xs font-bold text-foreground">
                  API region
                </label>
                <Select
                  id="qwen-endpoint-region"
                  className="mt-1.5"
                  {...form.register("endpointRegion")}
                >
                  <option value="singapore">Singapore</option>
                  <option value="us">US (Virginia)</option>
                  <option value="beijing">China (Beijing)</option>
                </Select>
              </div>
              {region !== "us" ? (
                <div>
                  <label htmlFor="qwen-workspace-id" className="text-xs font-bold text-foreground">
                    Workspace ID
                  </label>
                  <Input
                    id="qwen-workspace-id"
                    className="mt-1.5 font-mono"
                    placeholder="ws-example-01"
                    aria-invalid={Boolean(form.formState.errors.workspaceId)}
                    {...form.register("workspaceId")}
                  />
                  {form.formState.errors.workspaceId ? (
                    <p className="mt-1.5 text-xs text-danger" role="alert">
                      {form.formState.errors.workspaceId.message}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {saveCredential.isError ? (
            <p className="rounded-xl border border-danger/20 bg-danger/8 px-3 py-2 text-xs text-danger" role="alert">
              {readableError(saveCredential.error)}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              size="sm"
              className="min-h-11 sm:min-h-10"
              disabled={saveCredential.isPending}
            >
              {saveCredential.isPending ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <ShieldCheck aria-hidden="true" className="size-4" />
              )}
              {isPersonal ? "Rotate key" : "Save encrypted key"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-11 sm:min-h-10"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="min-h-11 sm:min-h-10"
            onClick={() => setEditing(true)}
          >
            <KeyRound aria-hidden="true" className="size-4" />
            {isPersonal ? "Rotate personal key" : "Add personal key"}
          </Button>
          {isPersonal ? (
            <ConfirmDialog
              title={`Remove ${info.label} key?`}
              description="The encrypted credential will be permanently deleted. OpsPilot will fall back to a workspace key when one is available."
              confirmLabel="Remove key"
              pending={deleteCredential.isPending}
              onConfirm={() => deleteCredential.mutate()}
              trigger={(
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-11 text-danger sm:min-h-10"
                >
                  <Trash2 aria-hidden="true" className="size-4" /> Remove
                </Button>
              )}
            />
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-11 sm:min-h-10"
            asChild
          >
            <a href={info.helpUrl} target="_blank" rel="noreferrer">
              Get a key <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          </Button>
        </div>
      )}

      {deleteCredential.isError ? (
        <p className="mt-3 text-xs text-danger" role="alert">
          {readableError(deleteCredential.error)}
        </p>
      ) : null}
    </article>
  );
}

export function ProviderCredentialsPanel() {
  const credentials = useQuery({
    queryKey: ["provider-credentials"],
    queryFn: browserApi.listProviderCredentials,
  });
  const executionOptions = useQuery({
    queryKey: ["execution-options"],
    queryFn: browserApi.executionOptions,
  });
  const personalByProvider = new Map(
    credentials.data?.items.map((credential) => [credential.provider, credential]) ?? [],
  );
  const platformByProvider = new Map(
    executionOptions.data?.providers.map((provider) => [
      provider.id,
      provider.credentialSource === "platform",
    ]) ?? [],
  );

  return (
    <section
      className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6"
      aria-labelledby="provider-vault-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">Provider vault</p>
          <h2 id="provider-vault-heading" className="mt-2 text-xl font-bold text-foreground">
            Bring your own model access
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground-muted">
            Connect Gemini, OpenAI, or Qwen as needed. Personal keys are encrypted by Django before storage, never returned by the API, and only decrypted for your authenticated Live Mode run. Gemini is the only shared platform provider in this release.
          </p>
        </div>
        <span className="grid size-11 place-items-center rounded-xl bg-surface-accent text-primary">
          <KeyRound aria-hidden="true" className="size-5" />
        </span>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-success/20 bg-success/8 p-4">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-success" />
        <p className="text-xs leading-5 text-foreground-muted">
          OpsPilot accepts only its vetted provider catalog and pinned models. Custom keys cannot supply a base URL, hidden prompt, or arbitrary model ID.
        </p>
      </div>

      {credentials.isPending || executionOptions.isPending ? (
        <p className="mt-5 flex min-h-11 items-center gap-2 text-sm text-foreground-muted" role="status">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-primary motion-reduce:animate-none" />
          Loading provider security status…
        </p>
      ) : credentials.isError || executionOptions.isError ? (
        <p className="mt-5 rounded-xl border border-warning/20 bg-warning/8 p-4 text-sm text-foreground-muted" role="alert">
          Provider credential status is temporarily unavailable. Existing Live Mode settings were not changed.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 xl:grid-cols-3">
          {(["gemini", "openai", "qwen"] as const).map((provider) => (
            <ProviderCredentialCard
              key={provider}
              provider={provider}
              credential={personalByProvider.get(provider)}
              platformEnabled={platformByProvider.get(provider) ?? false}
            />
          ))}
        </div>
      )}
    </section>
  );
}
