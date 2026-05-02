import { parseArgs } from "node:util";
import { createHash, randomBytes } from "node:crypto";
import { eq, ilike } from "drizzle-orm";
import { createDb, merchants, apiKeys } from "@pincerpay/db";
import { API_KEY_PREFIX_LENGTH } from "@pincerpay/core";

const USAGE = `
Usage:
  DATABASE_URL=postgresql://... pnpm create-api-key <command> [flags]

Commands:
  list                              List all merchants (id, name, auth_user_id)
  create --merchant <id|name>       Create a new API key for a merchant
         --label "<label>"          Label shown in the dashboard (default: "CLI")
         [--dry-run]                Compute the key but don't insert
  help                              Show this message

Examples:
  pnpm create-api-key list
  pnpm create-api-key create --merchant Fools --label "Fools staging"
  pnpm create-api-key create --merchant 7d9a... --label "production" --dry-run

The raw key is printed once. It is never recoverable. Save it immediately.
`.trim();

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function open() {
  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL is not set");
  return createDb(url);
}

async function listMerchants() {
  const { db, close } = open();
  try {
    const rows = await db
      .select({
        id: merchants.id,
        name: merchants.name,
        authUserId: merchants.authUserId,
      })
      .from(merchants)
      .orderBy(merchants.createdAt);

    if (rows.length === 0) {
      console.log("(no merchants)");
      return;
    }
    for (const m of rows) {
      console.log(`${m.id}  ${m.name.padEnd(28)}  auth:${m.authUserId}`);
    }
  } finally {
    await close();
  }
}

async function resolveMerchant(
  db: ReturnType<typeof createDb>["db"],
  identifier: string,
) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    identifier,
  );

  if (isUuid) {
    const [row] = await db
      .select({ id: merchants.id, name: merchants.name })
      .from(merchants)
      .where(eq(merchants.id, identifier))
      .limit(1);
    if (!row) fail(`No merchant found with id ${identifier}`);
    return row;
  }

  const matches = await db
    .select({ id: merchants.id, name: merchants.name })
    .from(merchants)
    .where(ilike(merchants.name, identifier))
    .limit(2);

  if (matches.length === 0) fail(`No merchant found with name "${identifier}"`);
  if (matches.length > 1) {
    fail(
      `Name "${identifier}" matched multiple merchants. Pass --merchant <id> instead. Run "list" to see ids.`,
    );
  }
  return matches[0];
}

async function createKey(opts: {
  merchant: string;
  label: string;
  dryRun: boolean;
}) {
  const { db, close } = open();
  try {
    const merchant = await resolveMerchant(db, opts.merchant);

    const rawKey = `pp_live_${randomBytes(32).toString("hex")}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const prefix = rawKey.slice(0, API_KEY_PREFIX_LENGTH);

    if (opts.dryRun) {
      console.log(`[dry-run] would create key for ${merchant.name} (${merchant.id})`);
      console.log(`[dry-run] label: ${opts.label}`);
      console.log(`[dry-run] prefix: ${prefix}`);
      console.log(`[dry-run] key (will not be inserted): ${rawKey}`);
      return;
    }

    await db.insert(apiKeys).values({
      merchantId: merchant.id,
      keyHash,
      prefix,
      label: opts.label,
    });

    console.log(`Created API key for ${merchant.name} (${merchant.id})`);
    console.log(`Label:  ${opts.label}`);
    console.log(`Prefix: ${prefix}`);
    console.log("");
    console.log(rawKey);
    console.log("");
    console.log("Save this now. It will never be shown again.");
  } finally {
    await close();
  }
}

async function main() {
  const command = process.argv[2];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(USAGE);
    return;
  }

  if (command === "list") {
    await listMerchants();
    return;
  }

  if (command === "create") {
    const { values } = parseArgs({
      args: process.argv.slice(3),
      options: {
        merchant: { type: "string" },
        label: { type: "string", default: "CLI" },
        "dry-run": { type: "boolean", default: false },
      },
      strict: true,
    });

    if (!values.merchant) fail("--merchant <id|name> is required for `create`");

    await createKey({
      merchant: values.merchant,
      label: values.label ?? "CLI",
      dryRun: values["dry-run"] ?? false,
    });
    return;
  }

  fail(`Unknown command: ${command}\n\n${USAGE}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
