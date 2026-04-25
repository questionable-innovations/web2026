import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    resolveAlias: {
      canvas: { browser: "./src/lib/empty.ts" },
    },
  },
};

export default config;
