import { defineConfig } from "vite";

/**
 * Vite app + Vitest config for the circuit lab.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.js"],
    include: ["tests/**/*.test.js"],
  },
});
