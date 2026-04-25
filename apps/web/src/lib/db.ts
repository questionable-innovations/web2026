import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import * as schema from "@/server/db/schema";

type Db = BetterSQLite3Database<typeof schema>;

let _db: Db | undefined;

function init(): Db {
  const url = (process.env.DATABASE_URL ?? "file:./data/app.db").replace(
    /^file:/,
    "",
  );
  mkdirSync(dirname(url), { recursive: true });

  const sqlite = new Database(url);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");

  const instance = drizzle(sqlite, { schema });
  migrate(instance, { migrationsFolder: join(process.cwd(), "drizzle") });
  return instance;
}

export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    if (!_db) _db = init();
    return Reflect.get(_db, prop, receiver);
  },
});
