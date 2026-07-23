import OpenAI from "openai";
import type { AppConfig } from "@/config/env.js";
import { buildLabYamlPrompt } from "@/prompts/lab-yaml.js";
import type {
  DiagramAiProvider,
  DiagramGenerateOptions,
  DiagramGenerationRequest,
  DiagramGenerationResult,
} from "@/ai/types.js";

/**
 * Meta AI provider — OpenAI SDK pointed at Meta's Responses API
 * (`https://api.meta.ai/v1`) for multimodal diagram → YAML.
 */
export class MetaDiagramProvider implements DiagramAiProvider {
  readonly name = "meta" as const;

  /**
   * @param config - App config with Meta API key, model, and base URL.
   */
  constructor(private readonly config: AppConfig) {}

  async generateLabYaml(
    request: DiagramGenerationRequest,
    options: DiagramGenerateOptions = {},
  ): Promise<DiagramGenerationResult> {
    if (!this.config.metaApiKey) {
      throw Object.assign(new Error("META_API_KEY is not configured."), {
        status: 503,
        code: "missing_meta_api_key",
      });
    }

    const onProgress = options.onProgress;
    await onProgress?.({ message: "Sending diagram to Meta…" });

    const client = new OpenAI({
      baseURL: this.config.metaBaseUrl,
      apiKey: this.config.metaApiKey,
    });

    const prompt = buildLabYamlPrompt({
      title: request.title,
      notes: request.notes,
    });
    const imageDataUrl = `data:${request.image.mimeType};base64,${request.image.data}`;

    await onProgress?.({ message: "Waiting for Meta response…" });
    let response;
    try {
      response = await client.responses.create({
        model: this.config.metaModel,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              {
                type: "input_image",
                image_url: imageDataUrl,
                detail: "auto",
              },
            ],
          },
        ],
      });
    } catch (err) {
      const status = (err as { status?: number } | null)?.status;
      const code = (err as { code?: string } | null)?.code;
      const message =
        err instanceof Error ? err.message : "Meta request failed.";
      if (status === 404 || code === "model_not_found") {
        throw Object.assign(
          new Error(
            `Meta model "${this.config.metaModel}" was not found for this API key. ` +
              `Check https://dev.meta.ai/ that Muse Spark is enabled (models.list should include it).`,
          ),
          { status: 502, code: "meta_model_not_found" },
        );
      }
      throw Object.assign(new Error(message), {
        status: typeof status === "number" ? status : 502,
        code: code || "meta_request_failed",
      });
    }

    const rawText = (response.output_text ?? "").trim();
    if (!rawText) {
      throw Object.assign(new Error("Meta returned an empty response."), {
        status: 502,
        code: "meta_empty_result",
      });
    }

    await onProgress?.({ message: "Validating generated YAML…" });
    return {
      yaml: rawText,
      provider: "meta",
      model: this.config.metaModel,
      rawText,
    };
  }
}
