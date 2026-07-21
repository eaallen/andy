import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
loadEnv({ path: path.join(serverRoot, ".env") });

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export type AiProviderName = "gemini" | "meta" | "demo";

function parseProvider(raw: string): AiProviderName {
  const value = raw.trim().toLowerCase();
  if (value === "gemini" || value === "meta" || value === "demo") {
    return value;
  }
  throw new Error(
    `Invalid AI_PROVIDER "${raw}". Expected "gemini", "meta", or "demo".`,
  );
}

const aiProvider = parseProvider(optional("AI_PROVIDER", "gemini"));

export const env = {
  port: Number(optional("PORT", "3001")) || 3001,
  aiProvider,
  corsOrigins: optional("CORS_ORIGINS", "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  geminiApiKey: optional("GEMINI_API_KEY"),
  geminiModel: optional("GEMINI_MODEL", "gemini-2.5-flash"),
  /** Meta / OpenAI-compatible Responses API key. */
  metaApiKey: optional("META_API_KEY"),
  metaModel: optional("META_MODEL", "muse-spark-1.1"),
  metaBaseUrl: optional("META_BASE_URL", "https://api.meta.ai/v1"),
  /** Default 20 MiB — large phone photos / diagram scans; override with MAX_UPLOAD_BYTES. */
  maxUploadBytes: Number(optional("MAX_UPLOAD_BYTES", String(20 * 1024 * 1024))),
};

export function assertProviderConfigured(): void {
  if (env.aiProvider === "gemini" && !env.geminiApiKey) {
    throw Object.assign(
      new Error(
        "GEMINI_API_KEY is required when AI_PROVIDER=gemini. Get a key from Google AI Studio.",
      ),
      { status: 503, code: "missing_gemini_api_key" },
    );
  }
  if (env.aiProvider === "meta" && !env.metaApiKey) {
    throw Object.assign(
      new Error(
        "META_API_KEY is required when AI_PROVIDER=meta.",
      ),
      { status: 503, code: "missing_meta_api_key" },
    );
  }
}
