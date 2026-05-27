import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export * from "./schema/index.js";
export * from "./hashing.js";

export type Database = ReturnType<typeof createDb>["db"];

export function createDb(connectionString: string, options?: { serverless?: boolean }) {
  const isPooler = connectionString.includes(":6543");
  const client = postgres(connectionString, {
    max: options?.serverless ? 1 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: isPooler ? false : true,
    ssl: isPooler ? "require" : false,
  });

  const db = drizzle(client, { schema });

  return {
    db,
    /** Gracefully close the underlying postgres connection pool */
    close: () => client.end(),
  };
}
