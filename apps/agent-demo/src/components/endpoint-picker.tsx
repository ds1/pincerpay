"use client";

import type { DemoEndpoint } from "@/lib/types";

interface EndpointPickerProps {
  endpoints: DemoEndpoint[];
  selected: DemoEndpoint | null;
  onSelect: (endpoint: DemoEndpoint) => void;
  onExecute: () => void;
  isExecuting: boolean;
}

export function EndpointPicker({
  endpoints,
  selected,
  onSelect,
  onExecute,
  isExecuting,
}: EndpointPickerProps) {
  return (
    <div data-tour="endpoint-picker" className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-text">Merchant Endpoints</h3>
        <p className="text-[11px] text-text-dim">APIs with per-request pricing via x402</p>
      </div>
      <div className="space-y-2">
        {endpoints.map((ep) => {
          const isSelected = selected?.path === ep.path;
          return (
            <button
              key={ep.path}
              onClick={() => onSelect(ep)}
              className={`w-full rounded-xl border p-3.5 text-left transition-all ${
                isSelected
                  ? "border-accent bg-accent/5"
                  : "border-border bg-bg-card hover:border-border-bright"
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded bg-cyan/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cyan">
                  {ep.method}
                </span>
                <span className="font-mono text-sm text-text">{ep.path}</span>
                <span className="ml-auto rounded-full bg-green/10 px-2 py-0.5 text-xs font-medium text-green">
                  {ep.price} USDC
                </span>
              </div>
              <p className="text-xs text-text-muted">{ep.description}</p>
            </button>
          );
        })}
      </div>
      <button
        data-tour="send-button"
        onClick={onExecute}
        disabled={!selected || isExecuting}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isExecuting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Executing...
          </span>
        ) : (
          "Send Request"
        )}
      </button>
    </div>
  );
}
