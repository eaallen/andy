import { env, assertProviderConfigured } from "@/config/env.js";
import { GeminiDiagramProvider } from "@/ai/gemini.js";
import { MetaDiagramProvider } from "@/ai/meta.js";
import { DemoDiagramProvider } from "@/ai/demo.js";
import type { DiagramAiProvider } from "@/ai/types.js";

export function createDiagramProvider(): DiagramAiProvider {
  if (env.aiProvider === "demo") {
    return new DemoDiagramProvider();
  }
  assertProviderConfigured();
  switch (env.aiProvider) {
    case "meta":
      return new MetaDiagramProvider();
    case "gemini":
      return new GeminiDiagramProvider();
    default: {
      const _exhaustive: never = env.aiProvider;
      throw new Error(`Unsupported AI provider: ${String(_exhaustive)}`);
    }
  }
}
