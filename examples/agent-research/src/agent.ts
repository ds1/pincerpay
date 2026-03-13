/**
 * AI Research Agent with PincerPay Integration
 * 
 * This demonstrates how an AI agent can automatically pay for
 * research and data services using USDC via PincerPay.
 * 
 * The agent uses the x402 protocol - when it receives HTTP 402,
 * it automatically signs a USDC payment and retries the request.
 * 
 * Run: pnpm start:agent
 * (Make sure the merchant server is running first)
 */

import { PincerPayAgent } from "@pincerpay/agent";

/**
 * Research Agent Configuration
 * 
 * This shows a production-ready AI agent with:
 * - Multi-chain support (Solana devnet + Base Sepolia)
 * - Spending policies to prevent runaway costs
 * - Automatic payment retry on 402 responses
 */
async function createResearchAgent() {
  const agent = await PincerPayAgent.create({
    // Support both Solana and Base for flexibility
    chains: ["solana-devnet", "base-sepolia"],
    
    // Agent's private key (in production, use secure key management)
    solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
    evmPrivateKey: process.env.AGENT_EVM_KEY,
    
    // Spending policies to limit costs
    policies: [
      {
        maxPerTransaction: "1000000",  // Max $1.00 per request
        maxPerDay: "10000000",        // Max $10.00 per day
      },
    ],
    
    // Optional: custom facilitator URL
    // facilitatorUrl: "https://facilitator.pincerpay.com",
  });
  
  return agent;
}

/**
 * Example: Research Agent fetching data
 * 
 * This shows how the agent automatically handles payments.
 * When the API returns 402, the agent:
 * 1. Reads the x402 payment requirements
 * 2. Signs a USDC transfer
 * 3. Retries with the payment proof
 */
async function fetchResearchData(agent: PincerPayAgent) {
  const merchantUrl = process.env.MERCHANT_URL ?? "http://localhost:3001";
  
  console.log("🔍 Research Agent starting...\n");
  console.log(`Agent address: ${agent.solanaAddress}`);
  console.log(`Supported chains: ${agent.chains.join(", ")}`);
  console.log(`Policy: $${Number(agent.getPolicy()?.maxPerDay || 0) / 1_000_000}/day max\n`);
  
  // Example 1: Fetch free topics (no payment needed)
  console.log("📡 Fetching free topic list...");
  try {
    const topicsRes = await agent.fetch(`${merchantUrl}/api/research/topics`);
    const topics = await topicsRes.json();
    console.log("✅ Available topics:", topics.topics);
  } catch (e) {
    console.log("❌ Error:", e instanceof Error ? e.message : e);
  }
  console.log();
  
  // Example 2: Fetch paid research summaries ($0.05)
  // The agent.fetch() handles the 402 automatically!
  console.log("📡 Fetching research summaries (0.05 USDC)...\n");
  try {
    const summariesRes = await agent.fetch(
      `${merchantUrl}/api/research/summaries?topic=AI`
    );
    
    if (summariesRes.ok) {
      const data = await summariesRes.json();
      console.log("✅ Research summaries received:");
      data.summaries.forEach((s: any) => {
        console.log(`  - ${s.title}`);
        console.log(`    ${s.excerpt}\n`);
      });
    } else {
      console.log(`❌ Request failed: ${summariesRes.status}`);
    }
  } catch (e) {
    console.log("❌ Error:", e instanceof Error ? e.message : e);
  }
  
  // Example 3: Fetch trend analysis ($0.10)
  console.log("📡 Fetching trend analysis (0.10 USDC)...\n");
  try {
    const trendsRes = await agent.fetch(
      `${merchantUrl}/api/research/trends?industry=tech`
    );
    
    if (trendsRes.ok) {
      const data = await trendsRes.json();
      console.log("✅ Industry trends received:");
      data.trends.forEach((t: any) => {
        console.log(`  - ${t.trend}: ${t.growth} (${t.sentiment})`);
      });
    }
  } catch (e) {
    console.log("❌ Error:", e instanceof Error ? e.message : e);
  }
  console.log();
  
  // Example 4: Competitor analysis ($0.25) - multi-chain
  console.log("📡 Fetching competitor analysis (0.25 USDC)...\n");
  try {
    const compRes = await agent.fetch(
      `${merchantUrl}/api/research/competitors?sector=AI`
    );
    
    if (compRes.ok) {
      const data = await compRes.json();
      console.log("✅ Competitor analysis received:");
      data.competitors.forEach((c: any) => {
        console.log(`  - ${c.name}: ${c.marketShare} share`);
        console.log(`    Strengths: ${c.strengths.join(", ")}`);
      });
    }
  } catch (e) {
    console.log("❌ Error:", e instanceof Error ? e.message : e);
  }
  console.log();
  
  // Example 5: Deep analysis - POST request ($0.50)
  console.log("📡 Requesting deep analysis (0.50 USDC)...\n");
  try {
    const analyzeRes = await agent.fetch(
      `${merchantUrl}/api/research/analyze`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "AI is transforming industries through automation and intelligent insights.",
          analysisType: "comprehensive",
        }),
      }
    );
    
    if (analyzeRes.ok) {
      const data = await analyzeRes.json();
      console.log("✅ Deep analysis received:");
      console.log(`  Sentiment: ${data.results.sentiment}`);
      console.log(`  Key themes: ${data.results.keyThemes.join(", ")}`);
      console.log(`  Recommendations:`);
      data.results.recommendations.forEach((r: string) => {
        console.log(`    - ${r}`);
      });
    }
  } catch (e) {
    console.log("❌ Error:", e instanceof Error ? e.message : e);
  }
  
  // Check spending
  const dailySpend = agent.getDailySpend();
  console.log("\n📊 Daily spending:");
  console.log(`  Date: ${dailySpend.date}`);
  console.log(`  Amount: $${Number(dailySpend.amount) / 1_000_000} USDC`);
}

async function main() {
  try {
    const agent = await createResearchAgent();
    await fetchResearchData(agent);
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
