import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import * as schema from "@/server/db/schema";

const url = (process.env.DATABASE_URL ?? "file:./data/app.db").replace(
  /^file:/,
  "",
);
mkdirSync(dirname(url), { recursive: true });

const sqlite = new Database(url);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
