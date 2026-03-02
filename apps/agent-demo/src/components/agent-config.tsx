"use client";

import type { AgentConfig, AgentStatus } from "@/lib/types";

const BASE58_CHARS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function randomBase58(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += BASE58_CHARS[Math.floor(Math.random() * BASE58_CHARS.length)];
  }
  return result;
}

interface AgentConfigPanelProps {
  config: AgentConfig;
  onChange: (config: AgentConfig) => void;
  isLive: boolean;
}

const STATUS_OPTIONS: { value: AgentStatus; label: string; color: string }[] = [
  { value: "active", label: "Active", color: "text-green" },
  { value: "paused", label: "Paused", color: "text-yellow" },
  { value: "revoked", label: "Revoked", color: "text-red" },
];

export function AgentConfigPanel({ config, onChange, isLive }: AgentConfigPanelProps) {
  function generateWallet() {
    onChange({ ...config, walletAddress: randomBase58(44) });
  }

  function toggleSmartAccount() {
    if (config.smartAccountPda) {
      onChange({ ...config, smartAccountPda: "", onChainLimit: "" });
    } else {
      onChange({
        ...config,
        smartAccountPda: randomBase58(44),
        onChainLimit: "5.00",
      });
    }
  }

  return (
    <div data-tour="agent-config" className="rounded-xl border border-border bg-bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text">Agent Configuration</h3>
          <p className="text-[11px] text-text-dim">On-chain identity and spending guardrails</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isLive
              ? "bg-green/10 text-green"
              : "bg-accent/10 text-accent"
          }`}
        >
          {isLive ? "Live — Solana Devnet" : "Simulation"}
        </span>
      </div>

      {/* Wallet */}
      <div className="mb-4">
        <label className="mb-1.5 block text-xs text-text-muted">Wallet Address</label>
        {config.walletAddress ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-bg-input px-3 py-2 font-mono text-xs text-text">
              {config.walletAddress}
            </code>
            <button
              onClick={generateWallet}
              className="shrink-0 rounded-lg bg-bg-input px-2 py-2 text-xs text-text-muted transition-colors hover:text-text"
              title="Regenerate"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={generateWallet}
            className="w-full rounded-lg border border-dashed border-border-bright bg-bg-input px-3 py-2.5 text-xs text-text-muted transition-colors hover:border-accent hover:text-accent"
          >
            Generate Demo Wallet
          </button>
        )}
      </div>

      {/* Chain + Status row */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs text-text-muted">Chain</label>
          <select
            value={config.chain}
            onChange={(e) => onChange({ ...config, chain: e.target.value })}
            className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text"
          >
            <option value="solana-devnet">Solana Devnet</option>
            <option value="base-sepolia">Base Sepolia</option>
            <option value="polygon-amoy">Polygon Amoy</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-text-muted">Agent Status</label>
          <select
            value={config.status}
            onChange={(e) => onChange({ ...config, status: e.target.value as AgentStatus })}
            className={`w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm ${
              STATUS_OPTIONS.find((o) => o.value === config.status)?.color ?? "text-text"
            }`}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Spending Limits */}
      <div data-tour="spending-limits" className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs text-text-muted">Max per Transaction</label>
          <div className="relative">
            <input
              type="text"
              value={config.maxPerTransaction}
              onChange={(e) => onChange({ ...config, maxPerTransaction: e.target.value })}
              className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 pr-14 text-sm text-text"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-dim">
              USDC
            </span>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-text-muted">Max per Day</label>
          <div className="relative">
            <input
              type="text"
              value={config.maxPerDay}
              onChange={(e) => onChange({ ...config, maxPerDay: e.target.value })}
              className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 pr-14 text-sm text-text"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-dim">
              USDC
            </span>
          </div>
        </div>
      </div>

      {/* Squads Smart Account */}
      <div data-tour="smart-account" className="border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-text">Squads Smart Account</span>
            <p className="text-[10px] text-text-dim">On-chain spending limits via Squads SPN</p>
          </div>
          <button
            onClick={toggleSmartAccount}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              config.smartAccountPda ? "bg-accent" : "bg-bg-input"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                config.smartAccountPda ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {config.smartAccountPda && (
          <div className="mt-2 space-y-2">
            <div>
              <label className="mb-1 block text-[10px] text-text-dim">Smart Account PDA</label>
              <code className="block truncate rounded-lg bg-bg-input px-2.5 py-1.5 font-mono text-[10px] text-text-muted">
                {config.smartAccountPda}
              </code>
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-text-dim">On-Chain Limit Remaining</label>
              <div className="relative">
                <input
                  type="text"
                  value={config.onChainLimit}
                  onChange={(e) => onChange({ ...config, onChainLimit: e.target.value })}
                  className="w-full rounded-lg border border-border bg-bg-input px-2.5 py-1.5 pr-14 text-xs text-text"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-text-dim">
                  USDC
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
