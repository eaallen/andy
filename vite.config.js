import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Shared Vitest settings for app and library builds.
 */
const testConfig = {
  environment: "jsdom",
  setupFiles: ["tests/setup.js"],
  include: ["tests/**/*.test.js"],
};

/**
 * Vite app + Vitest config, or library IIFE when `--mode lib`.
 * @param {{ mode: string }} env - Vite env (`mode` is `lib` for the CDN/publish bundle).
 */
export default defineConfig(function (env) {
  if (env.mode === "lib") {
    return {
      test: testConfig,
      build: {
        lib: {
          entry: path.resolve(rootDir, "js/circuit-lab-element.js"),
          name: "AndyCircuitLab",
          formats: ["iife"],
          fileName: function () {
            return "andy.js";
          },
        },
        outDir: "dist",
        emptyOutDir: true,
        cssCodeSplit: false,
      },
    };
  }

  return {
    test: testConfig,
  };
});
