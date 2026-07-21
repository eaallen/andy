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
  provider: "cursor" | "gemini";
  model: string;
  rawText: string;
};

export interface DiagramAiProvider {
  readonly name: "cursor" | "gemini";
  generateLabYaml(request: DiagramGenerationRequest): Promise<DiagramGenerationResult>;
}
