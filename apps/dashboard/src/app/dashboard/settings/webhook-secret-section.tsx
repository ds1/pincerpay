"use client";

import { useState } from "react";
import { regenerateWebhookSecret } from "./actions";

interface Props {
  hasSecretLive: boolean;
  hasSecretTest: boolean;
}

export function WebhookSecretSection({ hasSecretLive, hasSecretTest }: Props) {
  return (
    <div className="space-y-4">
      <SecretRow environment="live" hasSecret={hasSecretLive} />
      <SecretRow environment="test" hasSecret={hasSecretTest} />
    </div>
  );
}

function SecretRow({ environment, hasSecret }: { environment: "live" | "test"; hasSecret: boolean }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleRegenerate() {
    if (
      hasSecret &&
      !confirm(`Regenerating will invalidate your current ${environment} webhook secret. Existing ${environment} webhook integrations will fail signature verification until updated. Continue?`)
    ) {
      return;
    }
    setLoading(true);
    setMessage("");
    const result = await regenerateWebhookSecret(environment);
    if (result.success && result.webhookSecret) {
      setSecret(result.webhookSecret);
      setMessage(hasSecret ? "Secret regenerated. Update your webhook handler." : "Secret generated.");
    } else {
      setMessage(result.error ?? "Failed to generate secret");
    }
    setLoading(false);
  }

  return (
    <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold capitalize">{environment} mode secret</h3>
        {hasSecret && !secret && (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            active
          </span>
        )}
      </div>

      {secret && (
        <div className="mb-3">
          <label className="block text-xs text-[var(--muted-foreground)] mb-1">Copy now (shown once):</label>
          <code className="block p-2 text-xs font-mono bg-[var(--background)] rounded border border-[var(--border)] break-all select-all">
            {secret}
          </code>
        </div>
      )}

      {message && (
        <p className={`text-sm mb-3 ${message.includes("Failed") ? "text-[var(--destructive)]" : "text-[var(--success)]"}`}>
          {message}
        </p>
      )}

      <button
        onClick={handleRegenerate}
        disabled={loading}
        className="px-3 py-1.5 text-sm bg-[var(--card)] border border-[var(--border)] rounded-lg hover:bg-[var(--background)] transition-colors disabled:opacity-50"
      >
        {loading ? "Generating..." : hasSecret ? "Regenerate Secret" : "Generate Secret"}
      </button>
    </div>
  );
}
