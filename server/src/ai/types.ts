export type DiagramImageInput = {
  /** Base64-encoded image bytes (no data: URL prefix). */
  data: string;
  mimeType: string;
};

export type DiagramGenerationRequest = {
  image: DiagramImageInput;
  /** Optional title hint for the lab. */
  title?: string;
  /** Optional free-text notes from the instructor about intent. */
  notes?: string;
};

export type DiagramGenerationResult = {
  yaml: string;
  provider: "gemini" | "meta" | "demo";
  model: string;
  rawText: string;
};

/** Live status update while a provider is generating YAML. */
export type DiagramProgressEvent = {
  message: string;
};

export type DiagramProgressHandler = (
  event: DiagramProgressEvent,
) => void | Promise<void>;

export type DiagramGenerateOptions = {
  onProgress?: DiagramProgressHandler;
};

export interface DiagramAiProvider {
  readonly name: "gemini" | "meta" | "demo";
  generateLabYaml(
    request: DiagramGenerationRequest,
    options?: DiagramGenerateOptions,
  ): Promise<DiagramGenerationResult>;
}
