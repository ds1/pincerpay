"use client";

import { useState } from "react";
import { saveMerchantProfile } from "./actions";

interface MerchantFormProps {
  merchant?: {
    name: string;
    walletAddress: string;
    supportedChains: string[];
    webhookUrl: string | null;
  };
}

const AVAILABLE_CHAINS = [
  { value: "solana", label: "Solana" },
  { value: "solana-devnet", label: "Solana Devnet (Testnet)" },
  { value: "base", label: "Base" },
  { value: "base-sepolia", label: "Base Sepolia (Testnet)" },
  { value: "polygon", label: "Polygon" },
  { value: "polygon-amoy", label: "Polygon Amoy (Testnet)" },
];

export function MerchantForm({ merchant }: MerchantFormProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const formData = new FormData(e.currentTarget);
    const result = await saveMerchantProfile(formData);

    setMessage(result.success ? "Profile saved!" : result.error ?? "Failed to save");
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-[var(--muted-foreground)] mb-1">Business Name</label>
        <input
          name="name"
          defaultValue={merchant?.name}
          className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] outline-none"
          required
        />
      </div>
      <div>
        <label className="block text-sm text-[var(--muted-foreground)] mb-1">Wallet Address</label>
        <input
          name="walletAddress"
          defaultValue={merchant?.walletAddress}
          placeholder="Solana or EVM wallet address"
          className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] outline-none font-mono text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-sm text-[var(--muted-foreground)] mb-1">Supported Chains</label>
        <div className="grid grid-cols-2 gap-2">
          {AVAILABLE_CHAINS.map((chain) => (
            <label key={chain.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="chains"
                value={chain.value}
                defaultChecked={merchant?.supportedChains?.includes(chain.value)}
                className="rounded"
              />
              {chain.label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm text-[var(--muted-foreground)] mb-1">Webhook URL (optional)</label>
        <input
          name="webhookUrl"
          defaultValue={merchant?.webhookUrl ?? ""}
          placeholder="https://..."
          className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] outline-none text-sm"
        />
      </div>
      {message && (
        <p className={`text-sm ${message.includes("saved") ? "text-[var(--success)]" : "text-[var(--destructive)]"}`}>
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving ? "Saving..." : merchant ? "Update Profile" : "Create Profile"}
      </button>
    </form>
  );
}
