"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Cable,
  Check,
  Clipboard,
  Clock3,
  Laptop,
  LoaderCircle,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { browserApi } from "@/lib/api/browser-client";
import type { LocalConnectorPairing } from "@/lib/api/types";

type PairingDraft = {
  name: string;
  modelFast: string;
  modelBalanced: string;
  modelHigh: string;
};

const initialDraft: PairingDraft = {
  name: "Development workstation",
  modelFast: "qwen2.5:3b",
  modelBalanced: "qwen2.5:7b",
  modelHigh: "qwen2.5:14b",
};

function setupCommand(pairing: LocalConnectorPairing): string {
  const server =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
    "https://opspilot-api-dhk7.onrender.com";
  return [
    ".\\.venv\\Scripts\\python.exe opspilot_connector.py pair `",
    `  --server ${server} \``,
    `  --connector-id ${pairing.connector.id} \``,
    `  --pairing-code ${pairing.pairingCode} \``,
    "  --base-url http://127.0.0.1:11434/v1",
  ].join("\n");
}

function ModelField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-bold text-foreground">
        {label}
      </label>
      <Input
        id={id}
        className="mt-1.5 font-mono text-xs"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        minLength={2}
        maxLength={256}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

export function LocalConnectorPanel() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PairingDraft>(initialDraft);
  const [pairing, setPairing] = useState<LocalConnectorPairing | null>(null);
  const [copied, setCopied] = useState(false);
  const status = useQuery({
    queryKey: ["local-connector"],
    queryFn: browserApi.getLocalConnector,
    refetchInterval: 30_000,
  });
  const createPairing = useMutation({
    mutationFn: () => browserApi.createLocalConnectorPairing(draft),
    onSuccess: async (value) => {
      setPairing(value);
      await queryClient.invalidateQueries({ queryKey: ["local-connector"] });
    },
  });
  const disconnect = useMutation({
    mutationFn: browserApi.deleteLocalConnector,
    onSuccess: async () => {
      setPairing(null);
      await queryClient.invalidateQueries({ queryKey: ["local-connector"] });
      await queryClient.invalidateQueries({ queryKey: ["execution-options"] });
    },
  });
  const connector = status.data?.connector ?? null;
  const command = pairing ? setupCommand(pairing) : "";

  async function copyCommand() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <section
      className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6"
      aria-labelledby="local-connector-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
            Private model bridge
          </p>
          <h2 id="local-connector-heading" className="mt-2 text-xl font-bold text-foreground">
            Connect a local LLM without opening a public port
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground-muted">
            A small connector on your machine polls OpsPilot over outbound HTTPS, calls an
            OpenAI-compatible Ollama, LM Studio, or vLLM endpoint on your private network, and
            returns the structured result.
          </p>
        </div>
        <span className="grid size-11 place-items-center rounded-xl bg-surface-accent text-primary">
          <Cable aria-hidden="true" className="size-5" />
        </span>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-success/20 bg-success/8 p-4">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-success" />
        <p className="text-xs leading-5 text-foreground-muted">
          Pairing codes expire after 10 minutes and can be redeemed once. The connector token is
          stored only on your machine; the backend stores its one-way digest. Local model servers
          remain reachable only from the connector host.
        </p>
      </div>

      {status.isPending ? (
        <p
          className="mt-5 flex min-h-11 items-center gap-2 text-sm text-foreground-muted"
          role="status"
        >
          <LoaderCircle
            aria-hidden="true"
            className="size-4 animate-spin text-primary motion-reduce:animate-none"
          />
          Checking connector status…
        </p>
      ) : status.isError ? (
        <p
          className="mt-5 rounded-xl border border-warning/20 bg-warning/8 p-4 text-xs text-foreground-muted"
          role="alert"
        >
          Local connector status is temporarily unavailable. Existing settings were not changed.
        </p>
      ) : connector?.paired ? (
        <div className="mt-5 rounded-2xl border border-border bg-surface-soft p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-surface-raised text-primary">
                <Laptop aria-hidden="true" className="size-4.5" />
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">{connector.name}</p>
                <p className="mt-1 text-xs text-foreground-muted">
                  {connector.online
                    ? "Connector heartbeat received recently."
                    : "Connector is paired but has not checked in during the last 90 seconds."}
                </p>
              </div>
            </div>
            <Badge tone={connector.online ? "success" : "warning"}>
              {connector.online ? "Online" : "Offline"}
            </Badge>
          </div>
          <dl className="mt-4 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
            {[
              ["Efficient", connector.modelFast],
              ["Balanced", connector.modelBalanced],
              ["Deep", connector.modelHigh],
            ].map(([label, model]) => (
              <div key={label} className="min-w-0 bg-surface-raised p-3">
                <dt className="text-[0.6875rem] font-bold text-foreground-soft">{label}</dt>
                <dd className="mt-1 truncate font-mono text-xs text-foreground">{model}</dd>
              </div>
            ))}
          </dl>
          <Button
            type="button"
            variant="danger"
            size="sm"
            className="mt-4"
            disabled={disconnect.isPending}
            onClick={() => disconnect.mutate(connector.id)}
          >
            {disconnect.isPending ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Unplug aria-hidden="true" className="size-4" />
            )}
            Disconnect and invalidate token
          </Button>
        </div>
      ) : (
        <form
          className="mt-6 grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            createPairing.mutate();
          }}
        >
          <div>
            <label htmlFor="connector-name" className="text-xs font-bold text-foreground">
              Connector name
            </label>
            <Input
              id="connector-name"
              className="mt-1.5"
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
              required
              minLength={2}
              maxLength={80}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <ModelField
              id="connector-model-fast"
              label="Efficient model"
              value={draft.modelFast}
              onChange={(value) => setDraft((current) => ({ ...current, modelFast: value }))}
            />
            <ModelField
              id="connector-model-balanced"
              label="Balanced model"
              value={draft.modelBalanced}
              onChange={(value) =>
                setDraft((current) => ({ ...current, modelBalanced: value }))
              }
            />
            <ModelField
              id="connector-model-high"
              label="Deep model"
              value={draft.modelHigh}
              onChange={(value) => setDraft((current) => ({ ...current, modelHigh: value }))}
            />
          </div>
          <p className="flex items-start gap-2 text-xs leading-5 text-foreground-soft">
            <Clock3 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            Model IDs must already exist in your local server. OpsPilot never downloads or starts
            local models remotely.
          </p>
          {createPairing.isError ? (
            <p className="text-xs text-danger" role="alert">
              A pairing code could not be created. Review the model IDs and retry.
            </p>
          ) : null}
          <Button type="submit" className="w-fit" disabled={createPairing.isPending}>
            {createPairing.isPending ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Cable aria-hidden="true" className="size-4" />
            )}
            Generate one-time pairing command
          </Button>
        </form>
      )}

      {pairing ? (
        <div className="mt-5 rounded-2xl border border-primary/25 bg-surface-accent p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-foreground">
                Run this command within 10 minutes
              </p>
              <p className="mt-1 text-xs leading-5 text-foreground-muted">
                Download the repository’s connector folder, create its virtual environment, then
                run this one-time pairing command.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void copyCommand()}
            >
              {copied ? (
                <Check aria-hidden="true" className="size-4" />
              ) : (
                <Clipboard aria-hidden="true" className="size-4" />
              )}
              {copied ? "Copied" : "Copy command"}
            </Button>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-foreground p-4 text-xs leading-6 text-background">
            <code>{command}</code>
          </pre>
          <p className="mt-3 text-xs leading-5 text-foreground-soft">
            After pairing, run <code className="font-mono">opspilot_connector.py run</code> and
            keep that terminal open while using the Local connector provider.
          </p>
        </div>
      ) : null}
    </section>
  );
}
