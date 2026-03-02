import type {
  DemoEndpoint,
  AgentConfig,
  FlowStep,
  ExecutionResult,
  SpendingErrorCode,
} from "./types";

const BASE58_CHARS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function randomBase58(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += BASE58_CHARS[Math.floor(Math.random() * BASE58_CHARS.length)];
  }
  return result;
}

function generateTxHash(): string {
  return randomBase58(88);
}

function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function generateResponseSize(response: unknown): number {
  return JSON.stringify(response).length;
}

export function simulateFlow(
  endpoint: DemoEndpoint,
  agent: AgentConfig,
  currentSpend: number
): ExecutionResult {
  const price = endpoint.priceNum;
  const maxPerTx = parseFloat(agent.maxPerTransaction);
  const maxPerDay = parseFloat(agent.maxPerDay);
  const remaining = maxPerDay - currentSpend;
  const hasSmartAccount = agent.smartAccountPda.length > 0;
  const onChainLimit = hasSmartAccount ? parseFloat(agent.onChainLimit) : Infinity;

  // --- Agent-side policy checks (before signing) ---

  // Per-transaction limit
  if (agent.status === "active" && price > maxPerTx) {
    return buildAgentSideError(
      endpoint,
      agent,
      currentSpend,
      "PER_TX_LIMIT_EXCEEDED",
      `${endpoint.price} USDC exceeds per-transaction limit of ${agent.maxPerTransaction} USDC`
    );
  }

  // Daily limit
  if (agent.status === "active" && price > remaining) {
    return buildAgentSideError(
      endpoint,
      agent,
      currentSpend,
      "DAILY_LIMIT_EXCEEDED",
      `${endpoint.price} USDC exceeds remaining daily budget of ${remaining.toFixed(3)} USDC`
    );
  }

  // --- Facilitator-side checks (after signing, before settlement) ---

  // Agent status (facilitator rejects revoked/paused agents)
  if (agent.status === "revoked") {
    return buildFacilitatorSideError(
      endpoint,
      agent,
      currentSpend,
      "AGENT_REVOKED",
      "Agent access has been revoked by merchant"
    );
  }

  if (agent.status === "paused") {
    return buildFacilitatorSideError(
      endpoint,
      agent,
      currentSpend,
      "AGENT_PAUSED",
      "Agent access is temporarily paused"
    );
  }

  // On-chain Squads spending limit (facilitator checks via RPC)
  if (hasSmartAccount && price > onChainLimit) {
    return buildFacilitatorSideError(
      endpoint,
      agent,
      currentSpend,
      "SPENDING_LIMIT_EXHAUSTED",
      `${endpoint.price} USDC exceeds on-chain limit (${onChainLimit.toFixed(3)} USDC remaining)`
    );
  }

  // --- Happy path ---
  const txHash = generateTxHash();
  const responseSize = generateResponseSize(endpoint.mockResponse);
  const newTotalSpent = currentSpend + price;

  const steps: FlowStep[] = [
    {
      id: "step-1",
      type: "request",
      label: "Sending Request",
      detail: `${endpoint.method} ${endpoint.path}`,
      status: "complete",
      duration: 180 + Math.floor(Math.random() * 40),
      delay: 200,
    },
    {
      id: "step-2",
      type: "challenge",
      label: "Payment Required",
      detail: `402 — ${endpoint.price} USDC on ${endpoint.chain}`,
      status: "complete",
      duration: 250 + Math.floor(Math.random() * 100),
      delay: 300,
    },
    {
      id: "step-3",
      type: "sign",
      label: "Signing Payment",
      detail: `Wallet ${truncateAddress(agent.walletAddress)} authorizing ${endpoint.price} USDC`,
      status: "complete",
      duration: 350 + Math.floor(Math.random() * 100),
      delay: 400,
    },
    {
      id: "step-4",
      type: "verify",
      label: "Verifying Signature",
      detail: "Facilitator validating payment proof...",
      status: "complete",
      duration: 200 + Math.floor(Math.random() * 100),
      delay: 250,
    },
  ];

  // Insert SPN validation step when agent has Smart Account
  if (hasSmartAccount) {
    steps.push({
      id: "step-5",
      type: "spn-check",
      label: "SPN Policy Validated",
      detail: `Squads spending limit OK — ${(onChainLimit - price).toFixed(3)} USDC remaining`,
      status: "complete",
      duration: 150 + Math.floor(Math.random() * 80),
      delay: 200,
    });
  }

  const settleIdx = steps.length + 1;
  const responseIdx = steps.length + 2;

  steps.push(
    {
      id: `step-${settleIdx}`,
      type: "settle",
      label: "Payment Settled",
      detail: `tx ${truncateAddress(txHash)}`,
      status: "complete",
      duration: 300 + Math.floor(Math.random() * 100),
      delay: 350,
    },
    {
      id: `step-${responseIdx}`,
      type: "response",
      label: "Data Received",
      detail: `${responseSize} bytes — ${endpoint.description}`,
      status: "complete",
      duration: 120 + Math.floor(Math.random() * 60),
      delay: 150,
    }
  );

  return {
    steps,
    response: endpoint.mockResponse,
    cost: endpoint.price,
    txHash,
    totalSpent: newTotalSpent.toFixed(3),
    remainingBudget: (maxPerDay - newTotalSpent).toFixed(3),
  };
}

/**
 * Agent-side error: policy check fails before the agent signs.
 * Flow: Request → 402 → Policy Check ✗
 */
function buildAgentSideError(
  endpoint: DemoEndpoint,
  agent: AgentConfig,
  currentSpend: number,
  errorCode: SpendingErrorCode,
  errorDetail: string
): ExecutionResult {
  const maxPerDay = parseFloat(agent.maxPerDay);

  const steps: FlowStep[] = [
    {
      id: "step-1",
      type: "request",
      label: "Sending Request",
      detail: `${endpoint.method} ${endpoint.path}`,
      status: "complete",
      duration: 180 + Math.floor(Math.random() * 40),
      delay: 200,
    },
    {
      id: "step-2",
      type: "challenge",
      label: "Payment Required",
      detail: `402 — ${endpoint.price} USDC on ${endpoint.chain}`,
      status: "complete",
      duration: 250 + Math.floor(Math.random() * 100),
      delay: 300,
    },
    {
      id: "step-3",
      type: "error",
      label: errorCode,
      detail: errorDetail,
      status: "error",
      duration: 50,
      delay: 200,
    },
  ];

  return {
    steps,
    cost: "0",
    totalSpent: currentSpend.toFixed(3),
    remainingBudget: (maxPerDay - currentSpend).toFixed(3),
    errorCode,
  };
}

/**
 * Facilitator-side error: agent signs but facilitator rejects.
 * Flow: Request → 402 → Sign → Policy Check ✗
 */
function buildFacilitatorSideError(
  endpoint: DemoEndpoint,
  agent: AgentConfig,
  currentSpend: number,
  errorCode: SpendingErrorCode,
  errorDetail: string
): ExecutionResult {
  const maxPerDay = parseFloat(agent.maxPerDay);

  const steps: FlowStep[] = [
    {
      id: "step-1",
      type: "request",
      label: "Sending Request",
      detail: `${endpoint.method} ${endpoint.path}`,
      status: "complete",
      duration: 180 + Math.floor(Math.random() * 40),
      delay: 200,
    },
    {
      id: "step-2",
      type: "challenge",
      label: "Payment Required",
      detail: `402 — ${endpoint.price} USDC on ${endpoint.chain}`,
      status: "complete",
      duration: 250 + Math.floor(Math.random() * 100),
      delay: 300,
    },
    {
      id: "step-3",
      type: "sign",
      label: "Signing Payment",
      detail: `Wallet ${truncateAddress(agent.walletAddress)} authorizing ${endpoint.price} USDC`,
      status: "complete",
      duration: 350 + Math.floor(Math.random() * 100),
      delay: 400,
    },
    {
      id: "step-4",
      type: "error",
      label: errorCode,
      detail: `403 Forbidden — ${errorDetail}`,
      status: "error",
      duration: 80 + Math.floor(Math.random() * 40),
      delay: 250,
    },
  ];

  return {
    steps,
    cost: "0",
    totalSpent: currentSpend.toFixed(3),
    remainingBudget: (maxPerDay - currentSpend).toFixed(3),
    errorCode,
  };
}
