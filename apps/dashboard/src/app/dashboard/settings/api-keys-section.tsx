"use client";

import { useState } from "react";
import { createApiKey, revokeApiKey } from "./actions";

interface ApiKey {
  id: string;
  prefix: string;
  label: string;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export function ApiKeysSection({ keys }: { keys: ApiKey[] }) {
  const [newKey, setNewKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    const result = await createApiKey("Default");
    if (result.key) {
      setNewKey(result.key);
    }
    setCreating(false);
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
            <div>
              <span className="font-mono text-sm">{key.prefix}...</span>
              <span className="ml-2 text-sm text-[var(--muted-foreground)]">{key.label}</span>
              {!key.isActive && (
                <span className="ml-2 text-xs text-[var(--destructive)]">Revoked</span>
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

      <button
        onClick={handleCreate}
        disabled={creating}
        className="px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
      >
        {creating ? "Creating..." : "Create API Key"}
      </button>
    </div>
  );
}
