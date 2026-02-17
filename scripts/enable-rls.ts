import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  const tables = ["merchants", "api_keys", "paywalls", "transactions"];

  for (const table of tables) {
    await sql.unsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    console.log(`RLS enabled on ${table}`);
  }

  await sql.end();
  console.log("Done — all tables locked down via RLS");
}

main().catch(console.error);
