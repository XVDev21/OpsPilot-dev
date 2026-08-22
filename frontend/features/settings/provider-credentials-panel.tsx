"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Boxes,
  CheckCircle2,
  CloudOff,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  LogIn,
  Network,
  RefreshCcw,
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
  bedrock: {
    label: "Amazon Bedrock",
    icon: Boxes,
    helpUrl: "https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys.html",
    keyPlaceholder: "Amazon Bedrock bearer API key",
  },
  custom: {
    label: "OpenAI-compatible",
    icon: Network,
    helpUrl: "https://github.com/openai/openai-openapi",
    keyPlaceholder: "Provider bearer API key",
  },
} satisfies Record<Exclude<AIProvider, "local">, {
  label: string;
  icon: typeof KeyRound;
  helpUrl: string;
  keyPlaceholder: string;
}>;

const credentialFormSchema = z.object({
  provider: z.enum(["gemini", "openai", "qwen", "bedrock", "custom"]),
  apiKey: z.string().trim().min(16, "Enter the complete provider API key.").max(2_048),
  endpointRegion: z.enum(["singapore", "us", "beijing"]),
  workspaceId: z.string().trim().max(63),
  displayName: z.string().trim().max(80),
  baseUrl: z.string().trim().max(500),
  awsRegion: z.enum(["us-east-1", "us-east-2", "us-west-2", "ap-northeast-1", "ap-south-1", "ap-southeast-1", "ap-southeast-2", "eu-central-1", "eu-west-1", "eu-west-2"]),
  modelFast: z.string().trim().max(256),
  modelBalanced: z.string().trim().max(256),
  modelHigh: z.string().trim().max(256),
}).superRefine((value, context) => {
  if (
    value.provider === "qwen" &&
    value.endpointRegion !== "us" &&
    !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])$/.test(value.workspaceId)
  ) {
    context.addIssue({
      code: "custom",
      path: ["workspaceId"],
      message: "Enter the workspace ID shown in Alibaba Cloud Model Studio.",
    });
  }
  if (value.provider === "custom" && !/^https:\/\/[^\s]+$/i.test(value.baseUrl)) {
    context.addIssue({ code: "custom", path: ["baseUrl"], message: "Use the provider's public HTTPS API base URL." });
  }
  if (value.provider === "bedrock" || value.provider === "custom") {
    (["modelFast", "modelBalanced", "modelHigh"] as const).forEach((field) => {
      if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{1,255}$/.test(value[field])) {
        context.addIssue({ code: "custom", path: [field], message: "Enter the exact model ID for this tier." });
      }
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
  credentialStatusUnavailable,
  platformStatusUnavailable,
}: {
  provider: Exclude<AIProvider, "local">;
  credential: ProviderCredentialSummary | undefined;
  platformEnabled: boolean;
  credentialStatusUnavailable: boolean;
  platformStatusUnavailable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const info = providerInfo[provider];
  const Icon = info.icon;
  const form = useForm<CredentialForm>({
    resolver: zodResolver(credentialFormSchema),
    defaultValues: {
      provider,
      apiKey: "",
      endpointRegion: credential?.endpointRegion ?? (provider === "qwen" ? "singapore" : "us"),
      workspaceId: credential?.workspaceId ?? "",
      displayName: credential?.displayName ?? "",
      baseUrl: credential?.baseUrl ?? "",
      awsRegion: (credential?.awsRegion as CredentialForm["awsRegion"] | null) ?? "us-east-1",
      modelFast: credential?.modelFast ?? "",
      modelBalanced: credential?.modelBalanced ?? "",
      modelHigh: credential?.modelHigh ?? "",
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
      ...(provider === "bedrock" ? {
        displayName: values.displayName || "Amazon Bedrock",
        awsRegion: values.awsRegion,
        modelFast: values.modelFast,
        modelBalanced: values.modelBalanced,
        modelHigh: values.modelHigh,
      } : {}),
      ...(provider === "custom" ? {
        displayName: values.displayName || "Custom model",
        baseUrl: values.baseUrl,
        modelFast: values.modelFast,
        modelBalanced: values.modelBalanced,
        modelHigh: values.modelHigh,
      } : {}),
    }),
    onSuccess: async () => {
      form.reset({
        ...form.getValues(),
        apiKey: "",
        endpointRegion: region,
      });
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
  const statusUnavailable = !isPersonal && (
    credentialStatusUnavailable || platformStatusUnavailable
  );
  const status = isPersonal
    ? "Personal key"
    : statusUnavailable
      ? "Status unavailable"
      : platformEnabled
        ? "Workspace key"
        : "Not configured";
  let credentialDescription = "Add a personal key to enable this provider for your account.";
  if (isPersonal) {
    credentialDescription = `Encrypted key fingerprint ${credential?.keyFingerprint}.`;
  } else if (credentialStatusUnavailable) {
    credentialDescription = "Saved-key status could not be checked. You can still connect or replace this provider key.";
  } else if (platformStatusUnavailable) {
    credentialDescription = "Workspace availability could not be checked. You can still connect a personal key.";
  } else if (platformEnabled) {
    credentialDescription = "Live runs currently use the OpsPilot workspace credential.";
  }

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
              {credentialDescription}
            </p>
          </div>
        </div>
        <Badge tone={isPersonal ? "success" : platformEnabled && !statusUnavailable ? "primary" : "neutral"}>
          {status}
        </Badge>
      </div>

      {provider === "qwen" && credential?.configured ? (
        <p className="mt-3 rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs text-foreground-muted">
          {credential.endpointRegion === "us" ? "US (Virginia)" : credential.endpointRegion} endpoint
          {credential.workspaceId ? ` · workspace ${credential.workspaceId}` : ""}
        </p>
      ) : null}
      {(provider === "bedrock" || provider === "custom") && credential?.configured ? (
        <p className="mt-3 rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs leading-5 text-foreground-muted">
          {credential.displayName ?? info.label}
          {credential.awsRegion ? ` · ${credential.awsRegion}` : ""}
          {credential.baseUrl ? ` · ${credential.baseUrl}` : ""}
        </p>
      ) : null}

      {editing ? (
        <form
          className="mt-4 grid gap-4 border-t border-border pt-4"
          onSubmit={form.handleSubmit((values) => saveCredential.mutate(values))}
        >
          <input type="hidden" {...form.register("provider")} />
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

          {provider === "bedrock" || provider === "custom" ? (
            <div className="grid gap-4 rounded-xl border border-border bg-surface-raised p-4">
              <div>
                <label htmlFor={`${provider}-display-name`} className="text-xs font-bold text-foreground">
                  Connection name
                </label>
                <Input
                  id={`${provider}-display-name`}
                  className="mt-1.5"
                  placeholder={provider === "bedrock" ? "Production Bedrock" : "Private model gateway"}
                  {...form.register("displayName")}
                />
              </div>
              {provider === "bedrock" ? (
                <div>
                  <label htmlFor="bedrock-region" className="text-xs font-bold text-foreground">AWS Region</label>
                  <Select id="bedrock-region" className="mt-1.5" {...form.register("awsRegion")}>
                    <option value="us-east-1">US East (N. Virginia)</option>
                    <option value="us-east-2">US East (Ohio)</option>
                    <option value="us-west-2">US West (Oregon)</option>
                    <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                    <option value="ap-south-1">Asia Pacific (Mumbai)</option>
                    <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                    <option value="ap-southeast-2">Asia Pacific (Sydney)</option>
                    <option value="eu-central-1">Europe (Frankfurt)</option>
                    <option value="eu-west-1">Europe (Ireland)</option>
                    <option value="eu-west-2">Europe (London)</option>
                  </Select>
                </div>
              ) : (
                <div>
                  <label htmlFor="custom-base-url" className="text-xs font-bold text-foreground">Public HTTPS API base URL</label>
                  <Input
                    id="custom-base-url"
                    type="url"
                    className="mt-1.5 font-mono"
                    placeholder="https://models.example.com/v1"
                    aria-invalid={Boolean(form.formState.errors.baseUrl)}
                    {...form.register("baseUrl")}
                  />
                  <p className="mt-1.5 text-xs leading-5 text-foreground-soft">Private, loopback, redirected, and custom-port endpoints are rejected by the server.</p>
                  {form.formState.errors.baseUrl ? <p className="mt-1 text-xs text-danger" role="alert">{form.formState.errors.baseUrl.message}</p> : null}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                {([
                  ["modelFast", "Efficient model"],
                  ["modelBalanced", "Balanced model"],
                  ["modelHigh", "Deep model"],
                ] as const).map(([field, label]) => (
                  <div key={field}>
                    <label htmlFor={`${provider}-${field}`} className="text-xs font-bold text-foreground">{label}</label>
                    <Input
                      id={`${provider}-${field}`}
                      className="mt-1.5 font-mono text-xs"
                      placeholder={provider === "bedrock" ? "model or inference profile ID" : "model-id"}
                      aria-invalid={Boolean(form.formState.errors[field])}
                      {...form.register(field)}
                    />
                    {form.formState.errors[field] ? <p className="mt-1 text-xs text-danger" role="alert">{form.formState.errors[field]?.message}</p> : null}
                  </div>
                ))}
              </div>
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
            {isPersonal ? "Rotate personal key" : "Connect provider"}
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
  const statusError = credentials.error ?? executionOptions.error;
  const authenticationError = statusError instanceof ApiError && statusError.status === 401;
  const statusRequestId = statusError instanceof ApiError ? statusError.requestId : null;
  const statusPending = credentials.isPending || executionOptions.isPending;

  async function retryStatusCheck() {
    await Promise.all([credentials.refetch(), executionOptions.refetch()]);
  }

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
            Connect vetted cloud providers, Amazon Bedrock, or a public OpenAI-compatible endpoint. Personal keys are encrypted by Django before storage, never returned by the API, and only decrypted for your authenticated Live Mode run.
          </p>
        </div>
        <span className="grid size-11 place-items-center rounded-xl bg-surface-accent text-primary">
          <KeyRound aria-hidden="true" className="size-5" />
        </span>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-success/20 bg-success/8 p-4">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-success" />
        <p className="text-xs leading-5 text-foreground-muted">
          Custom endpoints are HTTPS-only and screened against private-network access. Hidden workflow instructions remain server-owned; account model IDs are mapped explicitly to Efficient, Balanced, and Deep.
        </p>
      </div>

      {statusPending ? (
        <p className="mt-5 flex min-h-11 items-center gap-2 text-sm text-foreground-muted" role="status">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-primary motion-reduce:animate-none" />
          Loading provider security status…
        </p>
      ) : credentials.isError || executionOptions.isError ? (
        <div className="mt-5 rounded-xl border border-warning/20 bg-warning/8 p-4" role="alert">
          <div className="flex items-start gap-3">
            <CloudOff aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {authenticationError ? "Live session needs attention" : "Provider status is temporarily unavailable"}
              </p>
              <p className="mt-1 text-xs leading-5 text-foreground-muted">
                {authenticationError
                  ? "OpsPilot could not authorize the provider status check. The connection fields remain available; refresh your sign-in before saving a key."
                  : "Saved credential and workspace availability could not be confirmed. The connection fields remain available, and no existing key was changed."}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="min-h-11 sm:min-h-10"
              onClick={() => void retryStatusCheck()}
              disabled={credentials.isFetching || executionOptions.isFetching}
            >
              {credentials.isFetching || executionOptions.isFetching ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <RefreshCcw aria-hidden="true" className="size-4" />
              )}
              Retry status check
            </Button>
            {authenticationError ? (
              <Button type="button" size="sm" variant="ghost" className="min-h-11 sm:min-h-10" asChild>
                <a href="/sign-in" target="_blank" rel="noreferrer">
                  <LogIn aria-hidden="true" className="size-4" /> Refresh sign-in
                </a>
              </Button>
            ) : null}
          </div>
          {statusRequestId ? (
            <details className="mt-3 text-xs text-foreground-soft">
              <summary className="min-h-11 cursor-pointer content-center font-semibold">Technical details</summary>
              <p className="font-mono">Request ID: {statusRequestId}</p>
            </details>
          ) : null}
        </div>
      ) : null}

      {!statusPending ? (
        <div className="mt-5 grid gap-3 xl:grid-cols-3">
          {(["gemini", "openai", "qwen", "bedrock", "custom"] as const).map((provider) => (
            <ProviderCredentialCard
              key={provider}
              provider={provider}
              credential={personalByProvider.get(provider)}
              platformEnabled={platformByProvider.get(provider) ?? false}
              credentialStatusUnavailable={credentials.isError}
              platformStatusUnavailable={executionOptions.isError}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
