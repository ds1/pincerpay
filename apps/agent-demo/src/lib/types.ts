export type FlowStepType =
  | "request"
  | "challenge"
  | "sign"
  | "verify"
  | "spn-check"
  | "settle"
  | "response"
  | "error";

export type FlowStepStatus = "pending" | "active" | "complete" | "error";

export interface FlowStep {
  id: string;
  type: FlowStepType;
  label: string;
  detail?: string;
  status: FlowStepStatus;
  duration?: number;
  delay?: number; // ms to wait before showing this step (for client-side replay)
}

export interface DemoEndpoint {
  method: string;
  path: string;
  price: string;
  priceNum: number;
  chain: string;
  description: string;
  mockResponse: unknown;
}

export type AgentStatus = "active" | "paused" | "revoked";

export type SpendingErrorCode =
  | "AGENT_REVOKED"
  | "AGENT_PAUSED"
  | "PER_TX_LIMIT_EXCEEDED"
  | "DAILY_LIMIT_EXCEEDED"
  | "SPENDING_LIMIT_EXHAUSTED";

export interface AgentConfig {
  walletAddress: string;
  chain: string;
  maxPerTransaction: string;
  maxPerDay: string;
  status: AgentStatus;
  smartAccountPda: string; // empty = no Smart Account
  onChainLimit: string; // simulated on-chain remaining amount (USDC)
}

export interface ExecutionResult {
  steps: FlowStep[];
  response?: unknown;
  cost: string;
  txHash?: string;
  totalSpent: string;
  remainingBudget: string;
  errorCode?: SpendingErrorCode;
}

export interface TransactionLogEntry {
  endpoint: string;
  cost: string;
  txHash: string;
  timestamp: number;
}
