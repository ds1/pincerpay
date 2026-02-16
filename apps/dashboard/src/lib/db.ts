import { createDb } from "@pincerpay/db";

// Singleton database connection for the dashboard
let db: ReturnType<typeof createDb> | undefined;

export function getDb() {
  if (!db) {
    db = createDb(process.env.DATABASE_URL!);
  }
  return db;
}
