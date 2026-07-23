export type AiProviderName = "gemini" | "meta" | "demo";

/**
 * Cloudflare Worker bindings used by the Andy server.
 * Secrets (API keys) are set via `wrangler secret put` / `.dev.vars`.
 */
export type Env = {
  AI_PROVIDER?: string;
  CORS_ORIGINS?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  META_API_KEY?: string;
  META_MODEL?: string;
  META_BASE_URL?: string;
  MAX_UPLOAD_BYTES?: string;
  WORKOS_API_KEY?: string;
  WORKOS_CLIENT_ID?: string;
  WORKOS_COOKIE_PASSWORD?: string;
  /** Optional absolute callback URL; defaults to `{origin}/callback`. */
  WORKOS_REDIRECT_URI?: string;
  /** WorkOS organization to auto-select for AuthKit (skips org picker). */
  WORKOS_ORGANIZATION_ID?: string;
  ASSETS: Fetcher;
};

/**
 * Normalized runtime config derived from Worker bindings.
 */
export type AppConfig = {
  aiProvider: AiProviderName;
  corsOrigins: string[];
  geminiApiKey: string;
  geminiModel: string;
  metaApiKey: string;
  metaModel: string;
  metaBaseUrl: string;
  maxUploadBytes: number;
  workosApiKey: string;
  workosClientId: string;
  workosCookiePassword: string;
  workosRedirectUri: string;
  workosOrganizationId: string;
};

/**
 * Reads an optional binding string with a fallback.
 * @param value - Raw binding value.
 * @param fallback - Default when missing or empty.
 */
function optional(value: string | undefined, fallback = ""): string {
  return value ?? fallback;
}

/**
 * Parses AI_PROVIDER into a known provider name.
 * @param raw - Raw AI_PROVIDER binding.
 */
function parseProvider(raw: string): AiProviderName {
  const value = raw.trim().toLowerCase();
  if (value === "gemini" || value === "meta" || value === "demo") {
    return value;
  }
  throw new Error(
    `Invalid AI_PROVIDER "${raw}". Expected "gemini", "meta", or "demo".`,
  );
}

/**
 * Builds AppConfig from Cloudflare Worker env bindings.
 * @param env - Worker bindings (vars + secrets + ASSETS).
 */
export function getAppConfig(env: Env): AppConfig {
  const aiProvider = parseProvider(optional(env.AI_PROVIDER, "gemini"));
  return {
    aiProvider,
    corsOrigins: optional(env.CORS_ORIGINS, "*")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    geminiApiKey: optional(env.GEMINI_API_KEY),
    geminiModel: optional(env.GEMINI_MODEL, "gemini-2.5-flash"),
    metaApiKey: optional(env.META_API_KEY),
    metaModel: optional(env.META_MODEL, "muse-spark-1.1"),
    metaBaseUrl: optional(env.META_BASE_URL, "https://api.meta.ai/v1"),
    maxUploadBytes:
      Number(optional(env.MAX_UPLOAD_BYTES, String(20 * 1024 * 1024))) ||
      20 * 1024 * 1024,
    workosApiKey: optional(env.WORKOS_API_KEY),
    workosClientId: optional(env.WORKOS_CLIENT_ID),
    workosCookiePassword: optional(env.WORKOS_COOKIE_PASSWORD),
    workosRedirectUri: optional(env.WORKOS_REDIRECT_URI),
    workosOrganizationId: optional(env.WORKOS_ORGANIZATION_ID),
  };
}

/**
 * Throws when WorkOS AuthKit bindings are incomplete.
 * @param config - Normalized app config.
 */
export function assertWorkosConfigured(config: AppConfig): void {
  if (!config.workosApiKey || !config.workosClientId || !config.workosCookiePassword) {
    throw Object.assign(
      new Error(
        "WORKOS_API_KEY, WORKOS_CLIENT_ID, and WORKOS_COOKIE_PASSWORD are required for auth.",
      ),
      { status: 503, code: "missing_workos_config" },
    );
  }
  if (config.workosCookiePassword.length < 32) {
    throw Object.assign(
      new Error("WORKOS_COOKIE_PASSWORD must be at least 32 characters."),
      { status: 503, code: "invalid_workos_cookie_password" },
    );
  }
}

/**
 * Throws a 503-style error when the selected provider lacks its API key.
 * @param config - Normalized app config.
 */
export function assertProviderConfigured(config: AppConfig): void {
  if (config.aiProvider === "gemini" && !config.geminiApiKey) {
    throw Object.assign(
      new Error(
        "GEMINI_API_KEY is required when AI_PROVIDER=gemini. Get a key from Google AI Studio.",
      ),
      { status: 503, code: "missing_gemini_api_key" },
    );
  }
  if (config.aiProvider === "meta" && !config.metaApiKey) {
    throw Object.assign(
      new Error("META_API_KEY is required when AI_PROVIDER=meta."),
      { status: 503, code: "missing_meta_api_key" },
    );
  }
}
