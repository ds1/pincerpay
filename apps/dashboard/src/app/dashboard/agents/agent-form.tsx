"use client";

import { useState } from "react";
import { deleteAgent, updateAgent } from "./actions";

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
  if (!baseUnits) return "\u2014";
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
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(agent.name);

  async function handleStatusToggle() {
    setPending(true);
    const newStatus = agent.status === "active" ? "paused" : "active";
    const formData = new FormData();
    formData.set("status", newStatus);
    await updateAgent(agent.id, formData);
    setPending(false);
  }

  async function handleRename() {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === agent.name) {
      setEditing(false);
      setEditName(agent.name);
      return;
    }
    setPending(true);
    const formData = new FormData();
    formData.set("name", trimmed);
    await updateAgent(agent.id, formData);
    setEditing(false);
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
        {editing ? (
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setEditing(false); setEditName(agent.name); } }}
            autoFocus
            disabled={pending}
            className="px-2 py-1 rounded bg-[var(--input)] border border-[var(--border)] text-sm font-medium w-full max-w-[200px]"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="hover:underline font-medium text-left"
            title="Click to rename"
          >
            {agent.name}
          </button>
        )}
      </td>
      <td className="py-3 font-mono text-xs truncate max-w-[140px]">
        <a href={`/dashboard/agents/${agent.id}`} className="hover:underline">
          {agent.solanaAddress}
        </a>
      </td>
      <td className={`py-3 font-medium ${statusColor(agent.status)}`}>
        {agent.status}
      </td>
      <td className="py-3">{formatUsdc(agent.maxPerTransaction)}</td>
      <td className="py-3">{formatUsdc(agent.maxPerDay)}</td>
      <td className="py-3 font-mono text-xs truncate max-w-[100px]">
        {agent.smartAccountPda ?? "\u2014"}
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
