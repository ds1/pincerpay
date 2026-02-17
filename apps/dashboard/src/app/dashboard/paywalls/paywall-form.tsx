"use client";

import { useState } from "react";
import { createPaywall, deletePaywall, togglePaywall } from "./actions";

interface Paywall {
  id: string;
  endpointPattern: string;
  amount: string;
  description: string;
  chains: string[] | null;
  isActive: boolean;
}

export function PaywallForm() {
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setError("");
    const result = await createPaywall(formData);
    if (result.success) {
      setShowForm(false);
    } else {
      setError(result.error ?? "Failed to create paywall");
    }
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-sm hover:opacity-90 transition-opacity"
      >
        Add Paywall
      </button>
    );
  }

  return (
    <form action={handleSubmit} className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Endpoint Pattern</label>
        <input
          name="endpointPattern"
          placeholder="GET /api/weather"
          required
          className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-transparent text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Amount (USDC)</label>
          <input
            name="amount"
            placeholder="0.01"
            required
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-transparent text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Chains (optional)</label>
          <input
            name="chains"
            placeholder="solana, base, polygon"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-transparent text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <input
          name="description"
          placeholder="Weather data endpoint"
          className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-transparent text-sm"
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-sm hover:opacity-90"
        >
          Create
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] hover:bg-[var(--muted)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function PaywallList({ paywalls }: { paywalls: Paywall[] }) {
  return (
    <div className="space-y-3">
      {paywalls.map((wall) => (
        <PaywallCard key={wall.id} paywall={wall} />
      ))}
    </div>
  );
}

function PaywallCard({ paywall }: { paywall: Paywall }) {
  async function handleDelete() {
    await deletePaywall(paywall.id);
  }

  async function handleToggle() {
    await togglePaywall(paywall.id, !paywall.isActive);
  }

  return (
    <div className={`p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-between ${!paywall.isActive ? "opacity-50" : ""}`}>
      <div>
        <p className="font-mono text-sm">{paywall.endpointPattern}</p>
        <p className="text-sm text-[var(--muted-foreground)]">{paywall.description}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-bold">{paywall.amount} USDC</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {paywall.chains?.join(", ") ?? "All chains"}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleToggle}
            className="px-2 py-1 text-xs rounded border border-[var(--border)] hover:bg-[var(--muted)]"
          >
            {paywall.isActive ? "Disable" : "Enable"}
          </button>
          <button
            onClick={handleDelete}
            className="px-2 py-1 text-xs rounded border border-red-500 text-red-500 hover:bg-red-500/10"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
