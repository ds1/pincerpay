import { CHAINS } from "@pincerpay/core";
import { DocSections } from "./doc-sections";

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--foreground)] font-mono text-xs">
      {children}
    </code>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="p-4 rounded-lg bg-[var(--muted)] text-xs font-mono overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  );
}

const chainEntries = Object.entries(CHAINS);

const sections = [
  {
    id: "quickstart",
    title: "Quickstart",
    content: (
      <>
        <p>Get from zero to accepting agent payments in 5 minutes:</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            <strong>Create a merchant profile</strong> in Settings with your
            wallet address and supported chains.
          </li>
          <li>
            <strong>Generate an API key</strong> in Settings. Save it securely.
          </li>
          <li>
            <strong>Install the SDK:</strong>
            <Pre>npm install @pincerpay/merchant</Pre>
          </li>
          <li>
            <strong>Add middleware</strong> to your Express or Hono server:
            <Pre>{`import { pincerpay } from "@pincerpay/merchant";

app.use(
  pincerpay({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: "YOUR_WALLET_ADDRESS",
    routes: {
      "GET /api/data": {
        price: "0.01",
        chain: "solana-devnet",
        description: "API access",
      },
    },
  })
);`}</Pre>
          </li>
          <li>
            <strong>Test with the agent SDK</strong> to make your first payment.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: "merchant-sdk",
    title: "Merchant SDK",
    content: (
      <>
        <p>
          The <Code>@pincerpay/merchant</Code> package provides middleware for
          Express and Hono servers.
        </p>
        <h4 className="font-semibold text-[var(--foreground)] mt-4">
          Express Middleware
        </h4>
        <Pre>{`import { pincerpay } from "@pincerpay/merchant";

app.use(
  pincerpay({
    apiKey: string,             // Your PincerPay API key
    merchantAddress: string,    // Wallet to receive payments
    facilitatorUrl?: string,    // Default: https://facilitator.pincerpay.com
    routes: {
      "METHOD /path": {
        price: string,          // USDC amount (e.g., "0.01")
        chain: string,          // Chain shorthand (e.g., "solana-devnet")
        description?: string,   // Human-readable description
      },
    },
  })
);`}</Pre>
        <h4 className="font-semibold text-[var(--foreground)] mt-4">
          Hono Middleware
        </h4>
        <Pre>{`import { pincerpayHono } from "@pincerpay/merchant";

// Same config as Express
app.use(pincerpayHono({ ... }));`}</Pre>
        <h4 className="font-semibold text-[var(--foreground)] mt-4">
          RoutePaywallConfig Fields
        </h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <Code>price</Code> — USDC amount as a string (e.g., &quot;0.01&quot;)
          </li>
          <li>
            <Code>chain</Code> — Chain shorthand (see Supported Chains)
          </li>
          <li>
            <Code>description</Code> — Optional description shown in 402
            response
          </li>
        </ul>
        <h4 className="font-semibold text-[var(--foreground)] mt-4">
          toBaseUnits Helper
        </h4>
        <Pre>{`import { toBaseUnits } from "@pincerpay/core";

toBaseUnits("1.5");  // "1500000" (USDC has 6 decimals)`}</Pre>
      </>
    ),
  },
  {
    id: "agent-sdk",
    title: "Agent SDK",
    content: (
      <>
        <p>
          The <Code>@pincerpay/agent</Code> package wraps <Code>fetch</Code> to
          automatically handle x402 payment challenges.
        </p>
        <Pre>{`import { PincerPayAgent } from "@pincerpay/agent";

const agent = await PincerPayAgent.create({
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  chains: ["solana-devnet"],
});

// Fetch a paywalled endpoint — payment is automatic
const res = await agent.fetch("https://merchant.example.com/api/data");
console.log(await res.json());`}</Pre>
        <h4 className="font-semibold text-[var(--foreground)] mt-4">
          Spending Policies
        </h4>
        <Pre>{`const agent = await PincerPayAgent.create({
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  chains: ["solana-devnet"],
  policies: [{ maxPerTransaction: "100000", maxPerDay: "5000000" }],
});`}</Pre>
      </>
    ),
  },
  {
    id: "chains",
    title: "Supported Chains",
    content: (
      <>
        <p>PincerPay supports the following chains for USDC settlement:</p>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="pb-2 pr-4 font-semibold text-[var(--foreground)]">
                  Shorthand
                </th>
                <th className="pb-2 pr-4 font-semibold text-[var(--foreground)]">
                  Name
                </th>
                <th className="pb-2 pr-4 font-semibold text-[var(--foreground)]">
                  USDC Address
                </th>
                <th className="pb-2 font-semibold text-[var(--foreground)]">
                  Type
                </th>
              </tr>
            </thead>
            <tbody>
              {chainEntries.map(([shorthand, chain]) => (
                <tr
                  key={shorthand}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="py-2 pr-4 font-mono">{shorthand}</td>
                  <td className="py-2 pr-4">{chain.name}</td>
                  <td className="py-2 pr-4 font-mono truncate max-w-[200px]">
                    {chain.usdcAddress}
                  </td>
                  <td className="py-2">
                    {chain.testnet ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-xs">
                        testnet
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs">
                        mainnet
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "testnet",
    title: "Testnet Guide",
    content: (
      <>
        <p>Test your integration on devnet before going to mainnet.</p>
        <h4 className="font-semibold text-[var(--foreground)] mt-4">
          1. Get Devnet SOL
        </h4>
        <p>
          Visit{" "}
          <a
            href="https://faucet.solana.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--primary)] hover:underline"
          >
            faucet.solana.com
          </a>{" "}
          and request devnet SOL for your agent wallet. You need a small amount
          for transaction fees.
        </p>
        <h4 className="font-semibold text-[var(--foreground)] mt-4">
          2. Get Devnet USDC
        </h4>
        <p>
          Use the{" "}
          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--primary)] hover:underline"
          >
            Circle faucet
          </a>{" "}
          to mint devnet USDC to your agent wallet address.
        </p>
        <h4 className="font-semibold text-[var(--foreground)] mt-4">
          3. End-to-End Test
        </h4>
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            Start your merchant server with <Code>chain: &quot;solana-devnet&quot;</Code>
          </li>
          <li>Run the agent SDK script pointing at your local server</li>
          <li>
            Check the Transactions page in your dashboard — you should see the
            payment
          </li>
        </ol>
      </>
    ),
  },
  {
    id: "api",
    title: "API Reference",
    content: (
      <>
        <p>
          The PincerPay Facilitator exposes the following endpoints. All
          requests use JSON.
        </p>
        <h4 className="font-semibold text-[var(--foreground)] mt-4">
          POST /v1/verify
        </h4>
        <p>
          Verifies a signed x402 payment payload. Called by merchant middleware
          before granting access.
        </p>
        <h4 className="font-semibold text-[var(--foreground)] mt-4">
          POST /v1/settle
        </h4>
        <p>
          Settles (broadcasts) a verified payment transaction on-chain. Called
          after the merchant delivers the resource.
        </p>
        <h4 className="font-semibold text-[var(--foreground)] mt-4">
          GET /v1/supported
        </h4>
        <p>
          Returns the list of supported payment schemes, chains, and tokens.
        </p>
        <h4 className="font-semibold text-[var(--foreground)] mt-4">
          GET /v1/status/:txHash
        </h4>
        <p>
          Returns the confirmation status of a transaction by its hash.
        </p>
        <h4 className="font-semibold text-[var(--foreground)] mt-4">Headers</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <Code>x-pincerpay-api-key</Code> — Your merchant API key (required
            for verify/settle)
          </li>
          <li>
            <Code>Content-Type: application/json</Code>
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "faq",
    title: "FAQ",
    content: (
      <>
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-[var(--foreground)]">
              Who pays gas fees?
            </p>
            <p>
              Agents always pay gas. On Solana, agents pay a small SOL fee
              (typically &lt;$0.001). PincerPay never subsidizes gas.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[var(--foreground)]">
              What is optimistic finality?
            </p>
            <p>
              For payments under $1 USDC, PincerPay releases the resource after
              the transaction is broadcast to the mempool (~200ms) rather than
              waiting for block confirmation. This keeps latency low for
              micropayments.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[var(--foreground)]">
              Which chain should I choose?
            </p>
            <p>
              Start with <Code>solana-devnet</Code> for testing. For production,{" "}
              <Code>solana</Code> offers the lowest fees and fastest finality.
              Use EVM chains (Base, Polygon) if your agents are EVM-native.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[var(--foreground)]">
              What format are webhook payloads?
            </p>
            <p>
              Webhooks send a POST request with a JSON body containing the
              transaction details: <Code>txHash</Code>, <Code>status</Code>,{" "}
              <Code>amount</Code>, <Code>chain</Code>, and{" "}
              <Code>endpointPattern</Code>. Configure your webhook URL in
              Settings.
            </p>
          </div>
        </div>
      </>
    ),
  },
];

export default function DocsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Documentation</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">
        Everything you need to integrate PincerPay into your application.
      </p>
      <DocSections sections={sections} />
    </div>
  );
}
