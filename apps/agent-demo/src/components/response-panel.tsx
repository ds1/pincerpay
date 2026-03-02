"use client";

interface ResponsePanelProps {
  response: unknown;
  cost: string | null;
  totalTime: number | null;
}

export function ResponsePanel({ response, cost, totalTime }: ResponsePanelProps) {
  if (!response) {
    return (
      <div data-tour="response-panel" className="rounded-xl border border-border bg-bg-card p-4">
        <h3 className="mb-4 text-sm font-semibold text-text">Response</h3>
        <div className="py-8 text-center text-sm text-text-dim">
          No response yet<br />
          <span className="text-text-dim/60">API response data will appear here</span>
        </div>
      </div>
    );
  }

  return (
    <div data-tour="response-panel" className="rounded-xl border border-border bg-bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Response</h3>
        <div className="flex items-center gap-2">
          {totalTime !== null && (
            <span className="rounded bg-bg-input px-2 py-0.5 text-[10px] text-text-dim">
              {totalTime}ms
            </span>
          )}
          <span className="rounded-full bg-green/10 px-2 py-0.5 text-xs font-medium text-green">
            200 OK
          </span>
          {cost && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
              {cost} USDC
            </span>
          )}
        </div>
      </div>
      <pre className="max-h-80 overflow-auto rounded-lg bg-bg-input p-4 font-mono text-xs leading-relaxed text-text-muted">
        {JSON.stringify(response, null, 2)}
      </pre>
    </div>
  );
}
