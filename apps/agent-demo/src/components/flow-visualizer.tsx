"use client";

import type { FlowStep, TransactionLogEntry } from "@/lib/types";

interface FlowVisualizerProps {
  steps: FlowStep[];
  transactionLog: TransactionLogEntry[];
}

function StepIcon({ status, type }: { status: FlowStep["status"]; type: FlowStep["type"] }) {
  if (status === "active") {
    return (
      <div className="animate-pulse-dot flex h-6 w-6 items-center justify-center rounded-full bg-accent/20">
        <div className="h-2.5 w-2.5 rounded-full bg-accent" />
      </div>
    );
  }
  if (status === "complete") {
    // SPN check gets a shield icon
    if (type === "spn-check") {
      return (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20">
          <svg className="h-3.5 w-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
      );
    }
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green/20">
        <svg className="h-3.5 w-3.5 text-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (status === "error" || type === "error") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red/20">
        <svg className="h-3.5 w-3.5 text-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }
  // pending
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border">
      <div className="h-2 w-2 rounded-full bg-text-dim" />
    </div>
  );
}

/** Check if a label looks like an error code (all caps + underscores) */
function isErrorCode(label: string): boolean {
  return /^[A-Z_]+$/.test(label);
}

export function FlowVisualizer({ steps, transactionLog }: FlowVisualizerProps) {
  return (
    <div data-tour="flow-visualizer" className="rounded-xl border border-border bg-bg-card p-4">
      <h3 className="mb-4 text-sm font-semibold text-text">x402 Payment Flow</h3>

      {steps.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-dim">
          Waiting for a request&hellip;<br />
          <span className="text-text-dim/60">The x402 payment flow will appear here</span>
        </div>
      ) : (
        <div className="space-y-1">
          {steps.map((step, i) => (
            <div key={step.id} className="animate-slide-in flex items-start gap-3 py-2">
              {/* Connector line */}
              <div className="flex flex-col items-center">
                <StepIcon status={step.status} type={step.type} />
                {i < steps.length - 1 && (
                  <div className="mt-1 h-4 w-px bg-border" />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {/* Error code badge */}
                  {step.status === "error" && isErrorCode(step.label) ? (
                    <span className="rounded bg-red/15 px-1.5 py-0.5 font-mono text-xs font-medium text-red">
                      {step.label}
                    </span>
                  ) : (
                    <span
                      className={`text-sm font-medium ${
                        step.status === "error"
                          ? "text-red"
                          : step.status === "active"
                          ? "text-accent"
                          : step.type === "spn-check"
                          ? "text-accent"
                          : step.status === "complete"
                          ? "text-text"
                          : "text-text-dim"
                      }`}
                    >
                      {step.label}
                    </span>
                  )}
                  {step.duration !== undefined && step.status === "complete" && (
                    <span className="rounded bg-bg-input px-1.5 py-0.5 text-[10px] text-text-dim">
                      {step.duration}ms
                    </span>
                  )}
                </div>
                {step.detail && (
                  <p className="mt-0.5 truncate font-mono text-xs text-text-muted">
                    {step.detail}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transaction Log */}
      {transactionLog.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <h4 className="mb-3 text-xs font-semibold text-text-muted">Transaction Log</h4>
          <div className="space-y-1.5">
            {transactionLog.map((entry, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-bg-input px-3 py-2 text-xs"
              >
                <span className="font-mono text-text-muted">{entry.endpoint}</span>
                <span className="text-green">{entry.cost} USDC</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
