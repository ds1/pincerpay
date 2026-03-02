"use client";

import { useState, useEffect } from "react";
import type { TransactionLogEntry } from "@/lib/types";

interface SpendTrackerProps {
  totalSpent: number;
  maxPerDay: number;
  transactions: TransactionLogEntry[];
  onChainLimit?: number;
  onChainEnabled?: boolean;
}

function getUtcMidnightCountdown(): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const diff = tomorrow.getTime() - now.getTime();
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

export function SpendTracker({ totalSpent, maxPerDay, transactions, onChainLimit, onChainEnabled }: SpendTrackerProps) {
  const percentage = maxPerDay > 0 ? Math.min((totalSpent / maxPerDay) * 100, 100) : 0;
  const isNearLimit = percentage > 80;
  const [countdown, setCountdown] = useState(getUtcMidnightCountdown());

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getUtcMidnightCountdown());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div data-tour="spend-tracker" className="rounded-xl border border-border bg-bg-card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-text">Spend Tracker</h3>
        <p className="text-[11px] text-text-dim">Real-time budget usage for this session</p>
      </div>

      {/* Daily limit progress bar */}
      <div className="mb-2">
        <div className="h-2 overflow-hidden rounded-full bg-bg-input">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isNearLimit ? "bg-yellow" : "bg-accent"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-medium text-text">
          {totalSpent.toFixed(3)} <span className="text-text-muted">/ {maxPerDay.toFixed(2)} USDC</span>
        </span>
        <span className="text-xs text-text-dim">{percentage.toFixed(1)}%</span>
      </div>

      <div className="mb-4 text-[10px] text-text-dim">
        Resets at 00:00 UTC ({countdown})
      </div>

      {/* On-chain limit */}
      {onChainEnabled && onChainLimit !== undefined && (
        <div className="mb-4 rounded-lg bg-accent/5 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-accent">Squads SPN Limit</span>
            <span className="font-mono text-xs text-accent">{onChainLimit.toFixed(3)} USDC</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-input">
            <div
              className="h-full rounded-full bg-accent/60 transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, (onChainLimit / maxPerDay) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {/* Per-request breakdown */}
      {transactions.length > 0 ? (
        <div className="space-y-1">
          {transactions.slice(-5).map((tx, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="font-mono text-text-dim">{tx.endpoint}</span>
              <span className="text-text-muted">-{tx.cost} USDC</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-xs text-text-dim">No transactions yet</div>
      )}
    </div>
  );
}
