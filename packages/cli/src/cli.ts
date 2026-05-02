import { Command } from "commander";
import { ApiError } from "./lib/api.js";
import { closePrompts } from "./lib/prompts.js";
import { runSignup } from "./commands/signup.js";
import { runLogin } from "./commands/login.js";
import { runLogout } from "./commands/logout.js";
import { runWhoami } from "./commands/whoami.js";
import { runCreateWallets } from "./commands/create-wallets.js";
import { runBootstrapMerchant } from "./commands/bootstrap-merchant.js";
import {
  runCreateApiKey,
  runListApiKeys,
  runRevokeApiKey,
  runRotateApiKey,
} from "./commands/api-keys.js";
import { runListSessions, runRevokeSession } from "./commands/sessions.js";
import { runWalletSet } from "./commands/wallet.js";
import { runEnv } from "./commands/env.js";
import {
  runChangePassword,
  runRecover,
  runResetPassword,
} from "./commands/password.js";

const program = new Command();

program
  .name("pincerpay")
  .description("Frictionless CLI for PincerPay merchant onboarding. No browser required.")
  .version("0.1.0")
  .option("--facilitator-url <url>", "Override facilitator URL (also: PINCERPAY_FACILITATOR_URL env var)");

program
  .command("signup")
  .description("Create a new PincerPay account. Walks through email + password + OTP verification.")
  .option("--email <email>", "Email address (otherwise prompted)")
  .action(async (opts) => {
    await runSignup({
      email: opts.email,
      facilitatorUrl: program.opts().facilitatorUrl,
    });
  });

program
  .command("login")
  .description("Sign in to an existing PincerPay account.")
  .option("--email <email>", "Email address (otherwise prompted)")
  .action(async (opts) => {
    await runLogin({
      email: opts.email,
      facilitatorUrl: program.opts().facilitatorUrl,
    });
  });

program
  .command("logout")
  .description("Revoke this CLI session and remove local credentials.")
  .action(async () => { await runLogout(); });

program
  .command("whoami")
  .description("Show the currently logged-in user and merchant info.")
  .action(async () => { await runWhoami(); });

program
  .command("recover")
  .description("Send a password recovery code to your email.")
  .option("--email <email>")
  .action(async (opts) => { await runRecover(opts.email); });

program
  .command("reset-password")
  .description("Reset your password using the recovery code from email.")
  .option("--email <email>")
  .action(async (opts) => { await runResetPassword(opts.email); });

program
  .command("change-password")
  .description("Change your password while logged in.")
  .action(async () => { await runChangePassword(); });

program
  .command("create-wallets")
  .description("Generate non-custodial Solana + EVM wallets from a single BIP-39 mnemonic. No auth required.")
  .option("--strength <12|24>", "Mnemonic word count", "12")
  .option("--mnemonic <words>", "Re-derive from an existing mnemonic")
  .option("--json", "Emit JSON")
  .option("--no-private-keys", "Suppress private keys (addresses + mnemonic only)")
  .action(async (opts) => {
    await runCreateWallets({
      strength: opts.strength === "24" ? 24 : 12,
      mnemonic: opts.mnemonic,
      json: !!opts.json,
      noPrivateKeys: opts.privateKeys === false,
    });
  });

program
  .command("bootstrap-merchant")
  .description("End-to-end merchant onboarding: generate wallets, create merchant, mint API key.")
  .requiredOption("--name <name>", "Merchant display name")
  .option("--chains <list>", "Comma-separated supported chains (default: solana,polygon)")
  .option("--webhook-url <url>")
  .option("--api-key-label <label>", "Label for the initial API key", "default")
  .option("--mnemonic <words>", "Use an existing mnemonic instead of generating one")
  .option("--strength <12|24>", "Mnemonic word count when generating", "12")
  .option("--skip-api-key", "Skip minting an initial API key (just create the merchant)")
  .action(async (opts) => {
    await runBootstrapMerchant({
      name: opts.name,
      chains: opts.chains ? opts.chains.split(",").map((s: string) => s.trim()) : undefined,
      webhookUrl: opts.webhookUrl,
      apiKeyLabel: opts.apiKeyLabel,
      mnemonic: opts.mnemonic,
      strength: opts.strength === "24" ? 24 : 12,
      skipApiKey: !!opts.skipApiKey,
    });
  });

const apiKeys = program.command("api-keys").description("Manage merchant API keys.");
apiKeys
  .command("create")
  .description("Mint a new API key.")
  .option("--label <label>", "Label for the key", "default")
  .action(async (opts) => { await runCreateApiKey(opts.label); });
apiKeys
  .command("list")
  .description("List all API keys for the current merchant.")
  .action(async () => { await runListApiKeys(); });
apiKeys
  .command("rotate <id>")
  .description("Atomically mint a new key and revoke the old one.")
  .action(async (id) => { await runRotateApiKey(id); });
apiKeys
  .command("revoke <id>")
  .description("Revoke an API key.")
  .action(async (id) => { await runRevokeApiKey(id); });

const wallet = program.command("wallet").description("Manage merchant wallet addresses.");
wallet
  .command("set")
  .description("Update the merchant's per-chain wallet addresses.")
  .option("--solana <address>")
  .option("--evm <address>")
  .option("--force", "Skip confirmation prompt")
  .action(async (opts) => {
    await runWalletSet({
      solana: opts.solana,
      evm: opts.evm,
      force: !!opts.force,
    });
  });

const sessions = program.command("sessions").description("Manage CLI sessions.");
sessions
  .command("list")
  .description("List active CLI sessions.")
  .action(async () => { await runListSessions(); });
sessions
  .command("revoke <id>")
  .description("Revoke a CLI session by id.")
  .action(async (id) => { await runRevokeSession(id); });

program
  .command("env")
  .description("Print an env-var template based on the current merchant config.")
  .action(async () => { await runEnv(); });

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof ApiError) {
      console.error(`✗ ${err.message}`);
      if (err.body && typeof err.body === "object") {
        const details = (err.body as { details?: unknown }).details;
        if (details) {
          console.error(JSON.stringify(details, null, 2));
        }
      }
      process.exit(1);
    }
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  } finally {
    closePrompts();
  }
}

main();
