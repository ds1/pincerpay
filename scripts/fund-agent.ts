import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const USDC_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

const facilitatorKey = process.env.FACILITATOR_PRIVATE_KEY as `0x${string}`;
const agentAddress = process.env.AGENT_ADDRESS as `0x${string}`;
const amount = BigInt(1_000_000); // 1 USDC (6 decimals)

const account = privateKeyToAccount(facilitatorKey);
const transport = http("https://sepolia.base.org");

const walletClient = createWalletClient({ account, chain: baseSepolia, transport });
const publicClient = createPublicClient({ chain: baseSepolia, transport });

async function main() {
  // Check facilitator USDC balance
  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(`Facilitator USDC balance: ${Number(balance) / 1e6} USDC`);

  // Transfer 1 USDC to agent
  console.log(`Transferring 1 USDC to agent ${agentAddress}...`);
  const hash = await walletClient.writeContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "transfer",
    args: [agentAddress, amount],
  });
  console.log(`TX hash: ${hash}`);

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber}, status: ${receipt.status}`);

  // Check agent balance
  const agentBalance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [agentAddress],
  });
  console.log(`Agent USDC balance: ${Number(agentBalance) / 1e6} USDC`);
}

main().catch(console.error);
