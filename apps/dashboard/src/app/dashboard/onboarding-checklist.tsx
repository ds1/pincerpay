"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  complete: boolean;
  href?: string;
  cta: string;
}

interface OnboardingChecklistProps {
  hasMerchant: boolean;
  hasApiKey: boolean;
  hasPaywall: boolean;
  hasTransaction: boolean;
}

const SDK_SNIPPET = `import { pincerpay } from "@pincerpay/merchant";

app.use(
  pincerpay({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: "YOUR_WALLET_ADDRESS",
    routes: {
      "GET /api/data": {
        price: "0.01",
        chain: "solana",
        description: "API access",
      },
    },
  })
);`;

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      width="20"
      height="20"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      width="20"
      height="20"
    >
      <circle cx="10" cy="10" r="7.25" />
    </svg>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--border)] transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export function OnboardingChecklist({
  hasMerchant,
  hasApiKey,
  hasPaywall,
  hasTransaction,
}: OnboardingChecklistProps) {
  const [sdkDismissed, setSdkDismissed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  useEffect(() => {
    setSdkDismissed(localStorage.getItem("pincerpay_sdk_step_done") === "true");
    setDismissed(
      localStorage.getItem("pincerpay_onboarding_dismissed") === "true"
    );
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const steps: OnboardingStep[] = [
    {
      id: "profile",
      title: "Create merchant profile",
      description: "Set up your business name, wallet address, and supported chains.",
      complete: hasMerchant,
      href: "/dashboard/settings",
      cta: "Set up profile",
    },
    {
      id: "apikey",
      title: "Generate an API key",
      description: "Create an API key to authenticate your server with PincerPay.",
      complete: hasApiKey,
      href: "/dashboard/settings",
      cta: "Create API key",
    },
    {
      id: "paywall",
      title: "Create your first paywall",
      description: "Define which endpoints require payment and set pricing.",
      complete: hasPaywall,
      href: "/dashboard/paywalls",
      cta: "Create paywall",
    },
    {
      id: "sdk",
      title: "Integrate the SDK",
      description: "Add the PincerPay middleware to your server.",
      complete: sdkDismissed,
      cta: "View code",
    },
    {
      id: "transaction",
      title: "Receive your first payment",
      description: "Once an agent pays for your API, you'll see it here.",
      complete: hasTransaction,
      href: "/dashboard/transactions",
      cta: "View transactions",
    },
  ];

  const completedCount = steps.filter((s) => s.complete).length;
  const allComplete = completedCount === steps.length;

  if (allComplete && dismissed) return null;

  if (dismissed) {
    return (
      <div className="mb-6">
        <button
          onClick={() => {
            localStorage.removeItem("pincerpay_onboarding_dismissed");
            setDismissed(false);
          }}
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline"
        >
          Show setup guide
        </button>
      </div>
    );
  }

  function handleDismiss() {
    localStorage.setItem("pincerpay_onboarding_dismissed", "true");
    setDismissed(true);
  }

  function handleSdkDone() {
    localStorage.setItem("pincerpay_sdk_step_done", "true");
    setSdkDismissed(true);
  }

  // Find the first incomplete step to highlight
  const currentStepId = steps.find((s) => !s.complete)?.id;

  return (
    <div className="mb-8 p-6 rounded-xl bg-[var(--card)] border border-[var(--border)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Get started with PincerPay</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {completedCount} of {steps.length} steps complete
          </p>
        </div>
        {!allComplete && (
          <button
            onClick={handleDismiss}
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-[var(--muted)] rounded-full mb-5">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      <div className="space-y-1">
        {steps.map((step) => {
          const isCurrent = step.id === currentStepId;
          const isExpanded = expandedStep === step.id;

          return (
            <div key={step.id}>
              <button
                onClick={() =>
                  setExpandedStep(isExpanded ? null : step.id)
                }
                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                  isCurrent
                    ? "bg-[var(--muted)]"
                    : "hover:bg-[var(--muted)]"
                }`}
              >
                {step.complete ? (
                  <CheckIcon className="text-emerald-500 shrink-0" />
                ) : (
                  <CircleIcon
                    className={`shrink-0 ${
                      isCurrent
                        ? "text-[var(--primary)]"
                        : "text-[var(--muted-foreground)]"
                    }`}
                  />
                )}
                <span
                  className={`text-sm font-medium ${
                    step.complete
                      ? "text-[var(--muted-foreground)] line-through"
                      : ""
                  }`}
                >
                  {step.title}
                </span>
              </button>

              {isExpanded && (
                <div className="ml-11 pb-3 pr-3">
                  <p className="text-sm text-[var(--muted-foreground)] mb-3">
                    {step.description}
                  </p>

                  {step.id === "sdk" && !step.complete && (
                    <div className="mb-3">
                      <div className="relative">
                        <pre className="p-4 rounded-lg bg-[var(--muted)] text-xs overflow-x-auto font-mono">
                          {SDK_SNIPPET}
                        </pre>
                        <CopyButton text={SDK_SNIPPET} />
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        <button
                          onClick={handleSdkDone}
                          className="px-3 py-1.5 text-sm bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90"
                        >
                          Mark as done
                        </button>
                        <Link
                          href="/docs/getting-started"
                          target="_blank"
                          className="text-sm text-[var(--primary)] hover:underline"
                        >
                          Full documentation
                        </Link>
                      </div>
                    </div>
                  )}

                  {step.id === "sdk" && step.complete && (
                    <Link
                      href="/docs/getting-started"
                      target="_blank"
                      className="text-sm text-[var(--primary)] hover:underline"
                    >
                      View full documentation
                    </Link>
                  )}

                  {step.href && step.id !== "sdk" && !step.complete && (
                    <Link
                      href={step.href}
                      className="inline-block px-3 py-1.5 text-sm bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90"
                    >
                      {step.cta}
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allComplete && (
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <p className="text-sm text-emerald-600 font-medium">
            All set! You&apos;re ready to accept agent payments.
          </p>
          <button
            onClick={handleDismiss}
            className="mt-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline"
          >
            Hide this guide
          </button>
        </div>
      )}
    </div>
  );
}
