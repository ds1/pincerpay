"use server";

import type { DemoEndpoint, AgentConfig, ExecutionResult } from "@/lib/types";
import { simulateFlow } from "@/lib/simulate";

export async function executeRequest(
  endpoint: DemoEndpoint,
  agent: AgentConfig,
  currentSpend: number
): Promise<ExecutionResult> {
  const isLive = process.env.DEMO_MODE === "live";

  if (isLive) {
    const { executeLive } = await import("@/lib/execute-live");
    return executeLive(endpoint, agent, currentSpend);
  }

  return simulateFlow(endpoint, agent, currentSpend);
}
