"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Stepper } from "./stepper";
import { CodeBlock } from "./code-block";
import { saveMerchantProfile } from "../settings/actions";
import { createApiKey } from "../settings/actions";
import { createPaywall } from "../paywalls/actions";

const STEPS = ["Profile", "API Key", "Integrate", "Done"];

interface SetupWizardProps {
  initialStep: number;
  userName: string;
  existingMerchant?: {
    walletAddress: string;
    supportedChains: string[];
  } | null;
}

function detectWalletType(address: string): string | null {
  if (/^0x[0-9a-fA-F]{40}$/.test(address)) return "EVM";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return "Solana";
  return null;
}

function buildSnippets(wallet: string, apiKey: string, chain: string) {
  const install = `npm install @pincerpay/merchant`;

  const env = `# .env
PINCERPAY_API_KEY=${apiKey}
MERCHANT_ADDRESS=${wallet}`;

  const express = `import express from "express";
import { pincerpay } from "@pincerpay/merchant";

const app = express();

app.use(
  pincerpay({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: "${wallet}",
    routes: {
      "GET /api/data": {
        price: "0.01",
        chain: "${chain}",
        description: "API access",
      },
    },
  })
);

app.get("/api/data", (req, res) => {
  res.json({ data: "Premium content" });
});

app.listen(3001, () => console.log("Server on :3001"));`;

  const hono = `import { Hono } from "hono";
import { pincerpayHono } from "@pincerpay/merchant";

const app = new Hono();

app.use(
  pincerpayHono({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: "${wallet}",
    routes: {
      "GET /api/data": {
        price: "0.01",
        chain: "${chain}",
        description: "API access",
      },
    },
  })
);

app.get("/api/data", (c) => c.json({ data: "Premium content" }));

export default app;`;

  const isSolana = chain.startsWith("solana");
  const keyParam = isSolana ? "solanaPrivateKey" : "evmPrivateKey";
  const keyEnv = isSolana ? "AGENT_SOLANA_KEY" : "AGENT_EVM_KEY";

  const agent = `import { PincerPayAgent } from "@pincerpay/agent";

const agent = await PincerPayAgent.create({
  ${keyParam}: process.env.${keyEnv}!,
  chains: ["${chain}"],
});

// Fetch a paywalled endpoint — payment is automatic
const res = await agent.fetch("http://localhost:3001/api/data");
console.log(await res.json());`;

  return { install, env, express, hono, agent };
}

// ─── Step 1: Merchant Profile ───

function StepProfile({
  userName,
  onComplete,
}: {
  userName: string;
  onComplete: (wallet: string, chain: string) => void;
}) {
  const [name, setName] = useState(userName);
  const [wallet, setWallet] = useState("");
  const [chains, setChains] = useState<string[]>(["solana-devnet"]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [showWebhook, setShowWebhook] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const walletType = wallet ? detectWalletType(wallet) : null;

  function toggleChain(chain: string) {
    setChains((prev) =>
      prev.includes(chain) ? prev.filter((c) => c !== chain) : [...prev, chain]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const formData = new FormData();
    formData.set("name", name);
    formData.set("walletAddress", wallet);
    chains.forEach((c) => formData.append("chains", c));
    if (webhookUrl) formData.set("webhookUrl", webhookUrl);

    const result = await saveMerchantProfile(formData);
    if (!result.success) {
      setError(result.error || "Failed to save profile");
      setSaving(false);
      return;
    }

    onComplete(wallet, chains[0] || "solana-devnet");
  }

  const chainOptions = [
    { value: "solana-devnet", label: "Solana Devnet", testnet: true },
    { value: "solana", label: "Solana Mainnet", testnet: false },
    { value: "base-sepolia", label: "Base Sepolia", testnet: true },
    { value: "base", label: "Base Mainnet", testnet: false },
    { value: "polygon-amoy", label: "Polygon Amoy", testnet: true },
    { value: "polygon", label: "Polygon Mainnet", testnet: false },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div>
        <label className="block text-sm font-medium mb-1">Business Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Wallet Address</label>
        <input
          type="text"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder="Solana or EVM address"
          className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] outline-none font-mono text-sm"
          required
        />
        {walletType && (
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Looks like a {walletType} address
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Supported Chains</label>
        <div className="p-3 rounded-lg border-l-4 border-blue-500 bg-blue-500/10 text-sm text-[var(--muted-foreground)] mb-3">
          Start on Solana Devnet to test with free tokens. Add mainnet later in Settings.
        </div>
        <div className="grid grid-cols-2 gap-2">
          {chainOptions.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--muted)] cursor-pointer"
            >
              <input
                type="checkbox"
                checked={chains.includes(opt.value)}
                onChange={() => toggleChain(opt.value)}
                className="accent-[var(--primary)]"
              />
              <span className="text-sm">
                {opt.label}
                {opt.testnet && (
                  <span className="ml-1 text-xs text-[var(--muted-foreground)]">
                    (testnet)
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowWebhook(!showWebhook)}
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          {showWebhook ? "Hide" : "Show"} webhook URL (optional)
        </button>
        {showWebhook && (
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-server.com/webhook"
            className="w-full mt-2 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] outline-none text-sm"
          />
        )}
      </div>

      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

      <button
        type="submit"
        disabled={saving || !name || !wallet || chains.length === 0}
        className="px-6 py-2 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Continue"}
      </button>
    </form>
  );
}

// ─── Step 2: API Key ───

function StepApiKey({
  onComplete,
}: {
  onComplete: (apiKey: string) => void;
}) {
  const [key, setKey] = useState("");
  const [pastedKey, setPastedKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    const result = await createApiKey("Setup Wizard");
    if (!result.success || !result.key) {
      setError(result.error || "Failed to generate key");
      setGenerating(false);
      return;
    }
    setKey(result.key);
    setGenerating(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // If they already generated a key but refreshed, let them paste it
  if (!key) {
    return (
      <div className="space-y-5 max-w-lg">
        <p className="text-sm text-[var(--muted-foreground)]">
          API keys authenticate your server with PincerPay. Generate one now, or
          paste an existing key if you already have one.
        </p>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-6 py-2 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
        >
          {generating ? "Generating..." : "Generate API Key"}
        </button>

        <div className="pt-3 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--muted-foreground)] mb-2">
            Already have a key? Paste it to continue:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={pastedKey}
              onChange={(e) => setPastedKey(e.target.value)}
              placeholder="pp_live_..."
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:border-[var(--primary)] outline-none font-mono text-sm"
            />
            <button
              onClick={() => pastedKey && onComplete(pastedKey)}
              disabled={!pastedKey.startsWith("pp_")}
              className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
            >
              Use Key
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-lg">
      <p className="text-sm text-[var(--muted-foreground)]">
        Your API key has been generated. Save it now — you won&apos;t see it again.
      </p>

      <div className="relative p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
        <code className="text-sm font-mono break-all">{key}</code>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--border)] transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <div className="p-3 rounded-lg border-l-4 border-amber-500 bg-amber-500/10 text-sm">
        Save this key now. You won&apos;t be able to see it again after leaving this page.
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="accent-[var(--primary)]"
        />
        <span className="text-sm">I&apos;ve saved my API key</span>
      </label>

      <button
        onClick={() => onComplete(key)}
        disabled={!saved}
        className="px-6 py-2 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
      >
        Continue
      </button>
    </div>
  );
}

// ─── Step 3: Integration Guide ───

function StepIntegrate({
  wallet,
  apiKey,
  chain,
  onComplete,
}: {
  wallet: string;
  apiKey: string;
  chain: string;
  onComplete: () => void;
}) {
  const [endpoint, setEndpoint] = useState("GET /api/data");
  const [amount, setAmount] = useState("0.01");
  const [description, setDescription] = useState("API access");
  const [paywallCreated, setPaywallCreated] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const snippets = buildSnippets(wallet, apiKey, chain);

  const tabs = [
    { label: "Install", code: snippets.install },
    { label: ".env", code: snippets.env },
    { label: "Express", code: snippets.express },
    { label: "Hono", code: snippets.hono },
    { label: "Test Agent", code: snippets.agent },
  ];

  async function handleCreatePaywall(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");

    const formData = new FormData();
    formData.set("endpointPattern", endpoint);
    formData.set("amount", amount);
    formData.set("description", description);
    formData.set("chains", chain);

    const result = await createPaywall(formData);
    if (!result.success) {
      setError(result.error || "Failed to create paywall");
      setCreating(false);
      return;
    }

    setPaywallCreated(true);
    setCreating(false);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted-foreground)]">
        Add the PincerPay middleware to your server. The code below uses your
        actual wallet and API key.
      </p>

      <CodeBlock tabs={tabs} />

      {/* Inline paywall creation */}
      <div className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
        <h3 className="text-sm font-semibold mb-3">Create your first paywall</h3>
        <form onSubmit={handleCreatePaywall} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--muted-foreground)] mb-1">
                Endpoint
              </label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--muted)] border border-[var(--border)] focus:border-[var(--primary)] outline-none text-sm font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted-foreground)] mb-1">
                Price (USDC)
              </label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--muted)] border border-[var(--border)] focus:border-[var(--primary)] outline-none text-sm"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[var(--muted-foreground)] mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--muted)] border border-[var(--border)] focus:border-[var(--primary)] outline-none text-sm"
            />
          </div>

          {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

          {!paywallCreated ? (
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Paywall"}
            </button>
          ) : (
            <p className="text-sm text-emerald-500 font-medium">
              Paywall created!
            </p>
          )}
        </form>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onComplete}
          className="px-6 py-2 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90"
        >
          {paywallCreated ? "Finish Setup" : "Skip for now"}
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Summary ───

function StepSummary({
  wallet,
  apiKeyPrefix,
  chain,
}: {
  wallet: string;
  apiKeyPrefix: string;
  chain: string;
}) {
  const router = useRouter();

  const truncatedWallet =
    wallet.length > 12
      ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
      : wallet;

  return (
    <div className="space-y-6 max-w-lg">
      <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
        <h3 className="text-lg font-semibold mb-1">You&apos;re all set!</h3>
        <p className="text-sm text-[var(--muted-foreground)]">
          Your merchant account is configured and ready to accept agent payments.
        </p>
      </div>

      <div className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
        <h4 className="text-sm font-semibold mb-3">Setup Summary</h4>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--muted-foreground)]">Wallet</dt>
            <dd className="font-mono">{truncatedWallet}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--muted-foreground)]">API Key</dt>
            <dd className="font-mono">{apiKeyPrefix}...</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--muted-foreground)]">Primary Chain</dt>
            <dd>{chain}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <a
          href="/dashboard/paywalls"
          className="text-[var(--primary)] hover:underline"
        >
          View paywalls
        </a>
        <span className="text-[var(--border)]">|</span>
        <a
          href="/dashboard/settings"
          className="text-[var(--primary)] hover:underline"
        >
          View API keys
        </a>
        <span className="text-[var(--border)]">|</span>
        <a
          href="/dashboard/docs"
          className="text-[var(--primary)] hover:underline"
        >
          Read the docs
        </a>
      </div>

      <button
        onClick={() => router.push("/dashboard")}
        className="px-6 py-2 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90"
      >
        Go to Dashboard
      </button>
    </div>
  );
}

// ─── Main Wizard ───

export function SetupWizard({
  initialStep,
  userName,
  existingMerchant,
}: SetupWizardProps) {
  const [step, setStep] = useState(initialStep);
  const [wallet, setWallet] = useState(existingMerchant?.walletAddress || "");
  const [chain, setChain] = useState(
    existingMerchant?.supportedChains[0] || "solana-devnet"
  );
  const [apiKey, setApiKey] = useState("");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Set up PincerPay</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">
        {step < 4
          ? `Step ${step} of 3 — ${STEPS[step - 1]}`
          : "Setup complete"}
      </p>

      <Stepper currentStep={step} steps={STEPS} />

      {step === 1 && (
        <StepProfile
          userName={userName}
          onComplete={(w, c) => {
            setWallet(w);
            setChain(c);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <StepApiKey
          onComplete={(k) => {
            setApiKey(k);
            setStep(3);
          }}
        />
      )}

      {step === 3 && (
        <StepIntegrate
          wallet={wallet}
          apiKey={apiKey}
          chain={chain}
          onComplete={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <StepSummary
          wallet={wallet}
          apiKeyPrefix={apiKey ? apiKey.slice(0, 12) : "pp_live_****"}
          chain={chain}
        />
      )}
    </div>
  );
}
