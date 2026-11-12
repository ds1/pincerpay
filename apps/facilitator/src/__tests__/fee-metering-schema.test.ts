// Fee metering schema guard (#158, #178). packages/db is not in the vitest
// workspace, so the db schema and migration checks live here.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { getTableConfig } from "drizzle-orm/pg-core";
import { merchants } from "@pincerpay/db";

const DRIZZLE_DIR = new URL("../../../../packages/db/drizzle/", import.meta.url);
const MIGRATION_TAG = "0005_merchant_fee_bps";

function read(relative: string): string {
  return readFileSync(new URL(relative, DRIZZLE_DIR), "utf8");
}

/** Collapses whitespace and drops identifier quotes and the public. prefix. */
function normalize(sql: string): string {
  return sql.replace(/"/g, "").replace(/public\./g, "").replace(/\s+/g, " ");
}

describe("merchants.fee_bps", () => {
  const column = getTableConfig(merchants).columns.find((c) => c.name === "fee_bps");

  it("exists on the merchants table", () => {
    expect(column).toBeDefined();
  });

  it("is a not-null integer that defaults to 100 basis points", () => {
    expect(column?.getSQLType()).toBe("integer");
    expect(column?.notNull).toBe(true);
    expect(column?.default).toBe(100);
  });
});

describe("merchant_fee_accruals migration", () => {
  const migration = normalize(read(`${MIGRATION_TAG}.sql`));
  const manual = normalize(read(`manual/${MIGRATION_TAG}.sql`));

  it("is registered in the drizzle journal", () => {
    const journal = JSON.parse(read("meta/_journal.json")) as { entries: Array<{ tag: string }> };
    expect(journal.entries.map((e) => e.tag)).toContain(MIGRATION_TAG);
  });

  for (const [label, sql] of [
    ["generated migration", migration],
    ["manual Supabase file", manual],
  ] as const) {
    describe(label, () => {
      it("adds the fee_bps column with a default of 100", () => {
        expect(sql).toMatch(/ADD COLUMN (IF NOT EXISTS )?fee_bps integer DEFAULT 100 NOT NULL/);
      });

      it("defines the view with the gross-up formula", () => {
        expect(sql).toContain("CREATE OR REPLACE VIEW merchant_fee_accruals WITH (security_invoker = true)");
        expect(sql).toContain("t.amount::numeric * m.fee_bps / (10000 + m.fee_bps)");
        expect(sql).toContain("date_trunc('month', t.created_at AT TIME ZONE 'UTC')::date AS month");
      });

      it("meters settled x402 payments only", () => {
        expect(sql).toContain("t.settlement_type = 'x402'");
        expect(sql).toContain("t.status IN ('confirmed', 'optimistic')");
      });

      it("keeps the anon and authenticated roles out", () => {
        expect(sql).toMatch(/REVOKE ALL ON merchant_fee_accruals FROM anon;/);
        expect(sql).toMatch(/REVOKE ALL ON merchant_fee_accruals FROM authenticated;/);
      });
    });
  }
});
