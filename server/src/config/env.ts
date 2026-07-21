import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
loadEnv({ path: path.join(serverRoot, ".env") });

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export type AiProviderName = "cursor" | "gemini";

function parseProvider(raw: string): AiProviderName {
  const value = raw.trim().toLowerCase();
  if (value === "cursor" || value === "gemini") {
    return value;
  }
  throw new Error(
    `Invalid AI_PROVIDER "${raw}". Expected "cursor" or "gemini".`,
  );
}

const aiProvider = parseProvider(optional("AI_PROVIDER", "cursor"));

export const env = {
  port: Number(optional("PORT", "3001")) || 3001,
  aiProvider,
  corsOrigins: optional("CORS_ORIGINS", "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  cursorApiKey: optional("CURSOR_API_KEY"),
  /** Cursor model id, e.g. grok-4.5 / composer-2.5 / auto. Discover with Cursor.models.list(). */
  cursorModel: optional("CURSOR_MODEL", "grok-4.5"),
  geminiApiKey: optional("GEMINI_API_KEY"),
  geminiModel: optional("GEMINI_MODEL", "gemini-2.5-flash"),
  maxUploadBytes: Number(optional("MAX_UPLOAD_BYTES", String(8 * 1024 * 1024))),
};

export function assertProviderConfigured(): void {
  if (env.aiProvider === "cursor" && !env.cursorApiKey) {
    throw Object.assign(
      new Error(
        "CURSOR_API_KEY is required when AI_PROVIDER=cursor. Create a key at Cursor Dashboard → API Keys.",
      ),
      { status: 503, code: "missing_cursor_api_key" },
    );
  }
  if (env.aiProvider === "gemini" && !env.geminiApiKey) {
    throw Object.assign(
      new Error(
        "GEMINI_API_KEY is required when AI_PROVIDER=gemini. Get a key from Google AI Studio.",
      ),
      { status: 503, code: "missing_gemini_api_key" },
    );
  }
}
