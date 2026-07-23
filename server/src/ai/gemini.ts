import { GoogleGenAI } from "@google/genai";
import type { AppConfig } from "@/config/env.js";
import { buildLabYamlPrompt } from "@/prompts/lab-yaml.js";
import type {
  DiagramAiProvider,
  DiagramGenerateOptions,
  DiagramGenerationRequest,
  DiagramGenerationResult,
} from "@/ai/types.js";

/**
 * Gemini provider — direct multimodal generateContent.
 * Good long-term default: lower latency than an agent loop, strong vision.
 */
export class GeminiDiagramProvider implements DiagramAiProvider {
  readonly name = "gemini" as const;

  /**
   * @param config - App config with Gemini API key and model.
   */
  constructor(private readonly config: AppConfig) {}

  async generateLabYaml(
    request: DiagramGenerationRequest,
    options: DiagramGenerateOptions = {},
  ): Promise<DiagramGenerationResult> {
    if (!this.config.geminiApiKey) {
      throw Object.assign(new Error("GEMINI_API_KEY is not configured."), {
        status: 503,
        code: "missing_gemini_api_key",
      });
    }

    const onProgress = options.onProgress;
    await onProgress?.({ message: "Sending diagram to Gemini…" });

    const ai = new GoogleGenAI({ apiKey: this.config.geminiApiKey });
    const prompt = buildLabYamlPrompt({
      title: request.title,
      notes: request.notes,
    });

    await onProgress?.({ message: "Waiting for Gemini response…" });
    const response = await ai.models.generateContent({
      model: this.config.geminiModel,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: request.image.mimeType,
                data: request.image.data,
              },
            },
          ],
        },
      ],
    });

    const rawText = (response.text ?? "").trim();
    if (!rawText) {
      throw Object.assign(new Error("Gemini returned an empty response."), {
        status: 502,
        code: "gemini_empty_result",
      });
    }

    await onProgress?.({ message: "Validating generated YAML…" });
    return {
      yaml: rawText,
      provider: "gemini",
      model: this.config.geminiModel,
      rawText,
    };
  }
}
