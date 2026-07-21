import { env, assertProviderConfigured } from "@/config/env.js";
import { CursorDiagramProvider } from "@/ai/cursor.js";
import { GeminiDiagramProvider } from "@/ai/gemini.js";
import type { DiagramAiProvider } from "@/ai/types.js";

export function createDiagramProvider(): DiagramAiProvider {
  assertProviderConfigured();
  if (env.aiProvider === "gemini") {
    return new GeminiDiagramProvider();
  }
  return new CursorDiagramProvider();
}
