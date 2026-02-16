import { createDb, type Database } from "@pincerpay/db";

// Singleton database connection for the dashboard
let db: Database | undefined;

export function getDb(): Database {
  if (!db) {
    const result = createDb(process.env.DATABASE_URL!);
    db = result.db;
  }
  return db;
}
