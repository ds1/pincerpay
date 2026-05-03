"use client";

import { useTransition } from "react";
import type { Environment } from "@pincerpay/db";
import { setEnvironment } from "./env-toggle-actions";

interface Props {
  current: Environment;
}

export function EnvToggle({ current }: Props) {
  const [pending, startTransition] = useTransition();

  function flip(next: Environment) {
    if (next === current) return;
    startTransition(() => {
      void setEnvironment(next);
    });
  }

  const isTest = current === "test";

  return (
    <div
      role="group"
      aria-label="Environment"
      className={`inline-flex rounded-full border ${
        isTest
          ? "border-amber-500/40 bg-amber-500/10"
          : "border-[var(--border)] bg-[var(--card)]"
      } p-0.5 text-xs`}
    >
      <button
        type="button"
        onClick={() => flip("live")}
        disabled={pending}
        className={`px-3 py-1 rounded-full transition-colors ${
          !isTest ? "bg-[var(--primary)] text-white" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        }`}
        aria-pressed={!isTest}
      >
        Live
      </button>
      <button
        type="button"
        onClick={() => flip("test")}
        disabled={pending}
        className={`px-3 py-1 rounded-full transition-colors ${
          isTest ? "bg-amber-500 text-black" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        }`}
        aria-pressed={isTest}
      >
        Test
      </button>
    </div>
  );
}
