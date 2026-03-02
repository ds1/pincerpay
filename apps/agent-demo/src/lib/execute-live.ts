import type { DemoEndpoint, AgentConfig, ExecutionResult, FlowStep } from "./types";

/**
 * Live mode execution — calls real merchant server with @pincerpay/agent SDK.
 * Only works when DEMO_MODE=live and dependencies are installed.
 */
export async function executeLive(
  endpoint: DemoEndpoint,
  agent: AgentConfig,
  currentSpend: number
): Promise<ExecutionResult> {
  const maxPerDay = parseFloat(agent.maxPerDay);
  const startTime = Date.now();
  const steps: FlowStep[] = [];

  try {
    // Dynamic import — these are optional deps
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PincerPayAgent } = await import(/* webpackIgnore: true */ "@pincerpay/agent" as string);

    steps.push({
      id: "step-1",
      type: "request",
      label: "Sending Request",
      detail: `${endpoint.method} http://localhost:3001${endpoint.path}`,
      status: "complete",
      duration: Date.now() - startTime,
      delay: 0,
    });

    const agentClient = await PincerPayAgent.create({
      chains: ["solana"],
      solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
      facilitatorUrl: process.env.FACILITATOR_URL,
    });

    // Wire up spending policies from agent config
    const maxPerTxBase = Math.round(parseFloat(agent.maxPerTransaction) * 1_000_000);
    const maxPerDayBase = Math.round(maxPerDay * 1_000_000);
    if (agentClient.setPolicy) {
      agentClient.setPolicy({
        maxPerTransaction: String(maxPerTxBase),
        maxPerDay: String(maxPerDayBase),
      });
    }

    const response = await agentClient.fetch(`http://localhost:3001${endpoint.path}`);
    const data = await response.json();
    const totalDuration = Date.now() - startTime;
    const price = endpoint.priceNum;
    const newTotalSpent = currentSpend + price;

    steps.push(
      {
        id: "step-2",
        type: "challenge",
        label: "Payment Required",
        detail: `402 — ${endpoint.price} USDC on ${endpoint.chain}`,
        status: "complete",
        duration: Math.floor(totalDuration * 0.2),
        delay: 0,
      },
      {
        id: "step-3",
        type: "sign",
        label: "Payment Signed",
        detail: `Wallet ${agent.walletAddress.slice(0, 4)}...${agent.walletAddress.slice(-4)}`,
        status: "complete",
        duration: Math.floor(totalDuration * 0.25),
        delay: 0,
      },
      {
        id: "step-4",
        type: "verify",
        label: "Signature Verified",
        detail: "Facilitator validated payment",
        status: "complete",
        duration: Math.floor(totalDuration * 0.15),
        delay: 0,
      },
      {
        id: "step-5",
        type: "settle",
        label: "Payment Settled",
        detail: "On-chain settlement confirmed",
        status: "complete",
        duration: Math.floor(totalDuration * 0.3),
        delay: 0,
      },
      {
        id: "step-6",
        type: "response",
        label: "Data Received",
        detail: `${JSON.stringify(data).length} bytes`,
        status: "complete",
        duration: Math.floor(totalDuration * 0.1),
        delay: 0,
      }
    );

    return {
      steps,
      response: data,
      cost: endpoint.price,
      totalSpent: newTotalSpent.toFixed(3),
      remainingBudget: (maxPerDay - newTotalSpent).toFixed(3),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Map SDK error messages to error codes
    const errorCode = errorMessage.includes("per-transaction") || errorMessage.includes("Exceeds per")
      ? ("PER_TX_LIMIT_EXCEEDED" as const)
      : errorMessage.includes("daily") || errorMessage.includes("Daily")
      ? ("DAILY_LIMIT_EXCEEDED" as const)
      : undefined;

    steps.push({
      id: `step-${steps.length + 1}`,
      type: "error",
      label: errorCode ?? "Execution Failed",
      detail: errorMessage,
      status: "error",
      duration: Date.now() - startTime,
      delay: 0,
    });

    return {
      steps,
      cost: "0",
      totalSpent: currentSpend.toFixed(3),
      remainingBudget: (maxPerDay - currentSpend).toFixed(3),
      errorCode,
    };
  }
}
