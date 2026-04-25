import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    resolveAlias: {
      canvas: { browser: "./src/lib/empty.ts" },
    },
  },
};

export default config;
