import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// App-Version aus der Root-package.json (eine Ebene über frontend/) als Single
// Source of Truth – wird beim Build in den Code eingesetzt (__APP_VERSION__).
const rootPkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
);

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version ?? "0.0.0"),
  },
  server: {
    port: 5173,
    proxy: {
      // Backend-Aufrufe im Dev-Betrieb an Fastify weiterleiten
      "/api": "http://localhost:8080",
    },
  },
});
