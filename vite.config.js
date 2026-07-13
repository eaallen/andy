import { defineConfig } from "vite";

/**
 * Vite app + Vitest config for the circuit lab.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
  },
});
