import { PincerPayAgent } from "@pincerpay/agent";

async function main() {
  // Create a payment-enabled agent
  const agent = new PincerPayAgent({
    chains: ["base-sepolia"],
    evmPrivateKey: process.env.AGENT_EVM_KEY!,
    policies: [
      {
        maxPerTransaction: "1000000", // 1 USDC max per tx
        maxPerDay: "10000000",        // 10 USDC max per day
      },
    ],
  });

  console.log(`Agent address: ${agent.evmAddress}`);
  console.log(`Supported chains: ${agent.chains.join(", ")}`);
  console.log();

  const merchantUrl = process.env.MERCHANT_URL ?? "http://localhost:3001";

  // Fetch a paywalled endpoint — agent.fetch handles 402 automatically
  console.log("Fetching weather data (paywalled)...");
  try {
    const response = await agent.fetch(`${merchantUrl}/api/weather`);

    if (response.ok) {
      const data = await response.json();
      console.log("Weather data received:");
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`Request failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
  }
}

main().catch(console.error);
