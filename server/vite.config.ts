import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [cloudflare()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
});
