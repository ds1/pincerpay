import chalk from "chalk";
import ora from "ora";
import { createInterface } from "readline";

const BASE58_CHARS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function randomBase58(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += BASE58_CHARS[Math.floor(Math.random() * BASE58_CHARS.length)];
  }
  return result;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Endpoint {
  method: string;
  path: string;
  price: string;
  priceNum: number;
  description: string;
  mockResponse: Record<string, unknown>;
}

const endpoints: Endpoint[] = [
  {
    method: "GET",
    path: "/api/weather",
    price: "0.001",
    priceNum: 0.001,
    description: "Real-time weather data",
    mockResponse: {
      city: "San Francisco",
      temp: 68,
      conditions: "Sunny",
      humidity: 52,
      wind: { speed: 12, direction: "NW" },
    },
  },
  {
    method: "GET",
    path: "/api/market-data",
    price: "0.01",
    priceNum: 0.01,
    description: "Live crypto market prices",
    mockResponse: {
      BTC: { price: 97432.51, change: "+2.3%" },
      ETH: { price: 3891.22, change: "-0.8%" },
      SOL: { price: 187.45, change: "+5.1%" },
    },
  },
  {
    method: "GET",
    path: "/api/research",
    price: "0.05",
    priceNum: 0.05,
    description: "AI research summary",
    mockResponse: {
      topic: "Agent-to-Agent Payments",
      summary: "The x402 protocol enables HTTP-native micropayments for AI agents...",
      confidence: 0.92,
    },
  },
  {
    method: "GET",
    path: "/api/premium-analytics",
    price: "0.10",
    priceNum: 0.1,
    description: "Premium analytics dashboard",
    mockResponse: {
      visitors: 12847,
      revenue: "$4,231.87",
      conversion_rate: "3.2%",
      top_page: "/pricing",
    },
  },
];

async function simulateRequest(
  endpoint: Endpoint,
  walletAddress: string,
  requestNum: number
): Promise<number> {
  const txHash = randomBase58(88);

  console.log();
  console.log(
    chalk.white.bold(`[${requestNum}]`),
    chalk.cyan(`${endpoint.method} ${endpoint.path}`),
    chalk.dim("—"),
    chalk.white(endpoint.description)
  );
  console.log(chalk.dim(`    Price: ${endpoint.price} USDC on Solana Devnet`));
  console.log();

  // Step 1: Request
  const spinner = ora({ text: "Sending request...", color: "cyan" }).start();
  await sleep(300);
  spinner.succeed(chalk.dim("Request sent"));

  // Step 2: 402 Challenge
  await sleep(200);
  console.log(chalk.yellow(`    ⚡ 402 Payment Required — ${endpoint.price} USDC`));

  // Step 3: Sign
  const signSpinner = ora({ text: `Signing payment with ${truncate(walletAddress, 12)}...`, color: "yellow" }).start();
  await sleep(500);
  signSpinner.succeed(chalk.dim("Payment signed"));

  // Step 4: Verify + Settle
  const settleSpinner = ora({ text: "Facilitator verifying...", color: "yellow" }).start();
  await sleep(400);
  settleSpinner.succeed(
    chalk.green(`Payment settled — tx ${truncate(txHash, 16)}`)
  );

  // Step 5: Response
  await sleep(200);
  console.log(chalk.green.bold("    ✓ Data received:"));
  console.log(
    chalk.dim(
      JSON.stringify(endpoint.mockResponse, null, 2)
        .split("\n")
        .map((line) => `      ${line}`)
        .join("\n")
    )
  );

  return endpoint.priceNum;
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const runAll = args.includes("--all");

  console.log();
  console.log(chalk.bold.white("  ╔══════════════════════════════════════╗"));
  console.log(chalk.bold.white("  ║  ") + chalk.bold.hex("#F97316")("PincerPay Agent Demo") + chalk.bold.white("              ║"));
  console.log(chalk.bold.white("  ║  ") + chalk.dim("x402 Protocol · USDC · Solana") + chalk.bold.white("    ║"));
  console.log(chalk.bold.white("  ╚══════════════════════════════════════╝"));
  console.log();

  const walletAddress = randomBase58(44);
  const dailyLimit = 1.0;
  let totalSpent = 0;

  console.log(chalk.dim("  Agent Wallet: ") + chalk.cyan(walletAddress));
  console.log(chalk.dim("  Chain:        ") + chalk.white("Solana Devnet"));
  console.log(chalk.dim("  Daily Limit:  ") + chalk.white(`${dailyLimit.toFixed(2)} USDC`));
  console.log(chalk.dim("  Mode:         ") + chalk.blue("Simulation"));
  console.log();

  if (runAll) {
    console.log(chalk.dim("  Running all endpoints...\n"));
    for (let i = 0; i < endpoints.length; i++) {
      const cost = await simulateRequest(endpoints[i], walletAddress, i + 1);
      totalSpent += cost;
      console.log(
        chalk.dim(`\n    Running total: ${totalSpent.toFixed(3)} / ${dailyLimit.toFixed(2)} USDC\n`)
      );
    }
  } else {
    let running = true;
    while (running) {
      console.log(chalk.white.bold("  Available endpoints:\n"));
      endpoints.forEach((ep, i) => {
        console.log(
          `    ${chalk.white.bold(`${i + 1}.`)} ${chalk.cyan(ep.path)} ${chalk.dim("—")} ${chalk.green(ep.price + " USDC")} ${chalk.dim("—")} ${ep.description}`
        );
      });
      console.log(`    ${chalk.white.bold("0.")} ${chalk.dim("Exit")}`);
      console.log();

      const answer = await prompt(chalk.white("  Choose endpoint (0-4): "));
      const choice = parseInt(answer, 10);

      if (choice === 0 || isNaN(choice)) {
        running = false;
        continue;
      }

      if (choice < 1 || choice > endpoints.length) {
        console.log(chalk.red("  Invalid choice\n"));
        continue;
      }

      const endpoint = endpoints[choice - 1];
      const remaining = dailyLimit - totalSpent;

      if (endpoint.priceNum > remaining) {
        console.log(
          chalk.red(
            `\n  ✗ Budget exceeded — ${endpoint.price} USDC > remaining ${remaining.toFixed(3)} USDC\n`
          )
        );
        continue;
      }

      const cost = await simulateRequest(endpoint, walletAddress, transactionCount + 1);
      totalSpent += cost;
      transactionCount++;
      console.log(
        chalk.dim(`\n    Running total: ${totalSpent.toFixed(3)} / ${dailyLimit.toFixed(2)} USDC\n`)
      );
    }
  }

  // Summary
  console.log();
  console.log(chalk.white.bold("  ───────────────────────────────────"));
  console.log(chalk.white.bold("  Session Summary"));
  console.log(chalk.dim(`  Total Spent:     `) + chalk.green(`${totalSpent.toFixed(3)} USDC`));
  console.log(chalk.dim(`  Remaining:       `) + chalk.white(`${(dailyLimit - totalSpent).toFixed(3)} USDC`));
  console.log(chalk.dim(`  Budget Used:     `) + chalk.white(`${((totalSpent / dailyLimit) * 100).toFixed(1)}%`));
  console.log(chalk.white.bold("  ───────────────────────────────────"));
  console.log();
}

let transactionCount = 0;

main().catch(console.error);
