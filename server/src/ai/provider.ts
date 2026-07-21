import { env, assertProviderConfigured } from "@/config/env.js";
import { CursorDiagramProvider } from "@/ai/cursor.js";
import { GeminiDiagramProvider } from "@/ai/gemini.js";
import { DemoDiagramProvider } from "@/ai/demo.js";
import type { DiagramAiProvider } from "@/ai/types.js";

export function createDiagramProvider(): DiagramAiProvider {
  if (env.aiProvider === "demo") {
    return new DemoDiagramProvider();
  }
  assertProviderConfigured();
  if (env.aiProvider === "gemini") {
    return new GeminiDiagramProvider();
  }
  return new CursorDiagramProvider();
}
