"use client";

import { useRef, useState } from "react";
import { createAgent, deleteAgent, updateAgent } from "./actions";

export function AgentForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await createAgent(formData);
    if (result.success) {
      setOpen(false);
      formRef.current?.reset();
    } else {
      setError(result.error ?? "Failed to create agent");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-90"
      >
        Add Agent
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] mb-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="name"
          placeholder="Agent name"
          required
          className="px-3 py-2 rounded-lg bg-[var(--input)] border border-[var(--border)] text-sm"
        />
        <input
          name="solanaAddress"
          placeholder="Solana address (base58)"
          required
          className="px-3 py-2 rounded-lg bg-[var(--input)] border border-[var(--border)] text-sm font-mono"
        />
        <input
          name="maxPerTransaction"
          placeholder="Max per transaction (USDC base units)"
          className="px-3 py-2 rounded-lg bg-[var(--input)] border border-[var(--border)] text-sm"
        />
        <input
          name="maxPerDay"
          placeholder="Max per day (USDC base units)"
          className="px-3 py-2 rounded-lg bg-[var(--input)] border border-[var(--border)] text-sm"
        />
      </div>
      {error && <p className="text-sm text-[var(--destructive)] mt-2">{error}</p>}
      <div className="flex gap-2 mt-3">
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium"
        >
          Create
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="px-4 py-2 rounded-lg bg-[var(--muted)] text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function AgentList({ agents }: { agents: Array<{
  id: string;
  name: string;
  solanaAddress: string;
  status: string;
  maxPerTransaction: string | null;
  maxPerDay: string | null;
  smartAccountPda: string | null;
  createdAt: Date;
}> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[var(--muted-foreground)] border-b border-[var(--border)]">
            <th className="pb-3 font-medium">Name</th>
            <th className="pb-3 font-medium">Solana Address</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 font-medium">Tx Limit</th>
            <th className="pb-3 font-medium">Daily Limit</th>
            <th className="pb-3 font-medium">Smart Account</th>
            <th className="pb-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <AgentRow key={agent.id} agent={agent} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatUsdc(baseUnits: string | null): string {
  if (!baseUnits) return "—";
  return `${(Number(baseUnits) / 1_000_000).toFixed(2)} USDC`;
}

function statusColor(status: string) {
  if (status === "active") return "text-[var(--success)]";
  if (status === "paused") return "text-yellow-400";
  return "text-[var(--destructive)]";
}

function AgentRow({ agent }: { agent: {
  id: string;
  name: string;
  solanaAddress: string;
  status: string;
  maxPerTransaction: string | null;
  maxPerDay: string | null;
  smartAccountPda: string | null;
  createdAt: Date;
} }) {
  const [pending, setPending] = useState(false);

  async function handleStatusToggle() {
    setPending(true);
    const newStatus = agent.status === "active" ? "paused" : "active";
    const formData = new FormData();
    formData.set("status", newStatus);
    await updateAgent(agent.id, formData);
    setPending(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return;
    setPending(true);
    await deleteAgent(agent.id);
    setPending(false);
  }

  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
      <td className="py-3">
        <a href={`/dashboard/agents/${agent.id}`} className="hover:underline font-medium">
          {agent.name}
        </a>
      </td>
      <td className="py-3 font-mono text-xs truncate max-w-[140px]">
        {agent.solanaAddress}
      </td>
      <td className={`py-3 font-medium ${statusColor(agent.status)}`}>
        {agent.status}
      </td>
      <td className="py-3">{formatUsdc(agent.maxPerTransaction)}</td>
      <td className="py-3">{formatUsdc(agent.maxPerDay)}</td>
      <td className="py-3 font-mono text-xs truncate max-w-[100px]">
        {agent.smartAccountPda ?? "—"}
      </td>
      <td className="py-3">
        <div className="flex gap-2">
          <button
            onClick={handleStatusToggle}
            disabled={pending}
            className="text-xs px-2 py-1 rounded bg-[var(--muted)] hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {agent.status === "active" ? "Pause" : "Activate"}
          </button>
          <button
            onClick={handleDelete}
            disabled={pending}
            className="text-xs px-2 py-1 rounded text-[var(--destructive)] hover:bg-[var(--destructive)] hover:text-white disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
