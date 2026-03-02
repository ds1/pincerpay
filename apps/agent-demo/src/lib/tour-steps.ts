export type TooltipPosition = "top" | "bottom" | "left" | "right";

export interface TourStep {
  target: string; // data-tour attribute value
  title: string;
  description: string;
  position: TooltipPosition;
  autoAction?: string; // action key dispatched to playground
  actionDelay?: number; // ms to wait before auto-advancing after action
}

export const tourSteps: TourStep[] = [
  {
    target: "playground-header",
    title: "Welcome to the Playground",
    description:
      "This is a live simulation of how AI agents pay for API access using the x402 protocol. We'll walk through the entire flow — from wallet setup to budget tracking.",
    position: "bottom",
  },
  {
    target: "agent-config",
    title: "Agent Wallet",
    description:
      "Every agent needs an on-chain identity. This wallet address is how the agent signs payments. In production, this maps to a real Solana or EVM private key.",
    position: "right",
    autoAction: "generate-wallet",
    actionDelay: 1500,
  },
  {
    target: "spending-limits",
    title: "Spending Policies",
    description:
      "Guardrails are critical. The per-transaction limit caps any single payment, while the daily limit resets at UTC midnight. These are enforced both agent-side (before signing) and facilitator-side (Squads SPN middleware).",
    position: "right",
  },
  {
    target: "endpoint-picker",
    title: "Choose an API",
    description:
      "These are merchant endpoints priced with x402. Each shows its per-request cost in USDC. Let's start with the weather API — it's the cheapest at $0.001.",
    position: "left",
    autoAction: "select-weather",
    actionDelay: 1500,
  },
  {
    target: "send-button",
    title: "Send the Request",
    description:
      "When the agent calls this endpoint, PincerPay handles everything: detects the 402 challenge, signs a USDC payment, and resubmits the request — all in one fetch() call.",
    position: "top",
    autoAction: "send-request",
    actionDelay: 4000,
  },
  {
    target: "flow-visualizer",
    title: "x402 Payment Flow",
    description:
      "Watch the payment flow: HTTP request → 402 challenge → sign → verify → settle → data delivered. When a Squads Smart Account is enabled, an SPN policy validation step appears before settlement.",
    position: "left",
  },
  {
    target: "response-panel",
    title: "API Response",
    description:
      "The data comes back just like a normal HTTP response. The agent doesn't need to know about payments — PincerPay handles that layer transparently.",
    position: "left",
  },
  {
    target: "spend-tracker",
    title: "Budget Tracking",
    description:
      "Every payment is tracked in real time. The progress bar shows how much of the daily budget has been consumed. This is how operators maintain visibility and control.",
    position: "right",
  },
  {
    target: "endpoint-picker",
    title: "Try a Premium Endpoint",
    description:
      "Now let's try something pricier. The premium analytics endpoint costs $0.10 per request — 100x more than weather. Same protocol, higher stakes.",
    position: "left",
    autoAction: "select-premium",
    actionDelay: 1500,
  },
  {
    target: "send-button",
    title: "Send Premium Request",
    description:
      "Same flow, higher cost. The agent checks maxPerTransaction and maxPerDay policies before signing. If it would exceed limits, it refuses automatically. Try setting the agent to 'paused' or 'revoked' to see facilitator-side rejections.",
    position: "top",
    autoAction: "send-request",
    actionDelay: 4000,
  },
  {
    target: "spend-tracker",
    title: "Budget Impact",
    description:
      "Notice how the budget jumped. Two requests, vastly different costs — both handled automatically. The progress bar and transaction log give full audit visibility.",
    position: "right",
  },
  {
    target: "playground-header",
    title: "That's x402",
    description:
      "HTTP-native micropayments for AI agents. No card rails, no 3% fees, sub-second settlement. Agents pay for exactly what they use, with built-in spending controls. Try more endpoints or explore the code!",
    position: "bottom",
  },
];
