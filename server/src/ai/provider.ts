import { assertProviderConfigured, type AppConfig } from "@/config/env.js";
import { GeminiDiagramProvider } from "@/ai/gemini.js";
import { MetaDiagramProvider } from "@/ai/meta.js";
import { DemoDiagramProvider } from "@/ai/demo.js";
import type { DiagramAiProvider } from "@/ai/types.js";

/**
 * Creates the diagram AI provider for the active AppConfig.
 * @param config - Normalized Worker config.
 */
export function createDiagramProvider(config: AppConfig): DiagramAiProvider {
  if (config.aiProvider === "demo") {
    return new DemoDiagramProvider();
  }
  assertProviderConfigured(config);
  switch (config.aiProvider) {
    case "meta":
      return new MetaDiagramProvider(config);
    case "gemini":
      return new GeminiDiagramProvider(config);
    default: {
      const _exhaustive: never = config.aiProvider;
      throw new Error(`Unsupported AI provider: ${String(_exhaustive)}`);
    }
  }
}
