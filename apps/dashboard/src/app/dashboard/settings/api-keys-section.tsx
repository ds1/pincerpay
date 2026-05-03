"use client";

import { useState } from "react";
import type { Environment } from "@pincerpay/db";
import { createApiKey, revokeApiKey } from "./actions";

interface ApiKey {
  id: string;
  prefix: string;
  label: string;
  isActive: boolean;
  environment: Environment;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export function ApiKeysSection({ keys }: { keys: ApiKey[] }) {
  const [newKey, setNewKey] = useState<string | null>(null);
  const [creating, setCreating] = useState<Environment | null>(null);

  async function handleCreate(environment: Environment) {
    setCreating(environment);
    const result = await createApiKey(environment === "test" ? "Test" : "Default", environment);
    if (result.key) {
      setNewKey(result.key);
    }
    setCreating(null);
  }

  async function handleRevoke(keyId: string) {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    await revokeApiKey(keyId);
    window.location.reload();
  }

  return (
    <div>
      {newKey && (
        <div className="p-4 mb-4 rounded-lg bg-[var(--success)]/10 border border-[var(--success)]/30">
          <p className="text-sm font-medium mb-1">New API Key Created</p>
          <p className="text-sm text-[var(--muted-foreground)] mb-2">
            Copy this key now — it won&apos;t be shown again.
          </p>
          <code className="block p-2 bg-[var(--muted)] rounded text-sm font-mono break-all">
            {newKey}
          </code>
        </div>
      )}

      <div className="space-y-2 mb-4">
        {keys.map((key) => (
          <div
            key={key.id}
            className="p-3 rounded-lg bg-[var(--card)] border border-[var(--border)] flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{key.prefix}...</span>
              <span
                className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  key.environment === "test"
                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                    : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                }`}
              >
                {key.environment}
              </span>
              <span className="text-sm text-[var(--muted-foreground)]">{key.label}</span>
              {!key.isActive && (
                <span className="text-xs text-[var(--destructive)]">Revoked</span>
              )}
            </div>
            {key.isActive && (
              <button
                onClick={() => handleRevoke(key.id)}
                className="text-xs text-[var(--destructive)] hover:underline"
              >
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => handleCreate("live")}
          disabled={creating !== null}
          className="px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
        >
          {creating === "live" ? "Creating..." : "Create live key"}
        </button>
        <button
          onClick={() => handleCreate("test")}
          disabled={creating !== null}
          className="px-4 py-2 border border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/15 transition-colors disabled:opacity-50"
        >
          {creating === "test" ? "Creating..." : "Create test key"}
        </button>
      </div>
    </div>
  );
}
