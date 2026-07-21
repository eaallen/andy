import { Hono } from "hono";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { env } from "@/config/env.js";
import { createDiagramProvider } from "@/ai/provider.js";
import { validateLabYaml } from "@/lab/validate.js";
import type { DiagramGenerationResult } from "@/ai/types.js";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

/**
 * Normalizes an image MIME type (e.g. image/jpg → image/jpeg).
 * @param mime - Raw Content-Type or file.type value.
 */
function normalizeMime(mime: string): string {
  const value = (mime || "").toLowerCase().split(";")[0]!.trim();
  if (value === "image/jpg") {
    return "image/jpeg";
  }
  return value;
}

type ParsedImageRequest = {
  imageBase64: string;
  mimeType: string;
  title?: string;
  notes?: string;
};

type JsonError = {
  error: string;
  code: string;
  status: 400 | 413;
};

/**
 * Parses multipart or JSON diagram upload into a shared request shape.
 * @param c - Hono context for the POST body.
 */
async function parseImageRequest(
  c: Context,
): Promise<ParsedImageRequest | JsonError> {
  const contentType = c.req.header("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const body = await c.req.parseBody({ all: true });
    const file = body.image;

    if (!(file instanceof File)) {
      return {
        error: 'Expected multipart field "image" as a file.',
        code: "missing_image",
        status: 400,
      };
    }

    if (file.size > env.maxUploadBytes) {
      return {
        error: `Image exceeds max size of ${env.maxUploadBytes} bytes.`,
        code: "image_too_large",
        status: 413,
      };
    }

    const mimeType = normalizeMime(file.type || "application/octet-stream");
    if (!ALLOWED_MIME.has(mimeType)) {
      return {
        error: `Unsupported image type "${mimeType}". Use png, jpeg, webp, or gif.`,
        code: "unsupported_mime",
        status: 400,
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    return {
      imageBase64: buffer.toString("base64"),
      mimeType,
      title: typeof body.title === "string" ? body.title : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    };
  }

  const json = await c.req.json<{
    imageBase64?: string;
    mimeType?: string;
    title?: string;
    notes?: string;
  }>();

  if (!json.imageBase64 || !json.mimeType) {
    return {
      error: "JSON body requires imageBase64 and mimeType.",
      code: "missing_image",
      status: 400,
    };
  }

  const imageBase64 = json.imageBase64.replace(/^data:[^;]+;base64,/, "");
  const mimeType = normalizeMime(json.mimeType);

  if (!ALLOWED_MIME.has(mimeType)) {
    return {
      error: `Unsupported image type "${mimeType}". Use png, jpeg, webp, or gif.`,
      code: "unsupported_mime",
      status: 400,
    };
  }

  const approxBytes = Math.floor((imageBase64.length * 3) / 4);
  if (approxBytes > env.maxUploadBytes) {
    return {
      error: `Image exceeds max size of ${env.maxUploadBytes} bytes.`,
      code: "image_too_large",
      status: 413,
    };
  }

  return {
    imageBase64,
    mimeType,
    title: json.title,
    notes: json.notes,
  };
}

/**
 * Builds the JSON payload returned after successful generation + validation.
 * @param generated - Provider result before validation.
 * @param validated - Output of validateLabYaml.
 */
function buildSuccessPayload(
  generated: DiagramGenerationResult,
  validated: ReturnType<typeof validateLabYaml>,
) {
  return {
    yaml: validated.yaml,
    lab: validated.lab,
    warnings: validated.issues
      .filter((i) => i.level === "warning")
      .map((i) => i.message),
    provider: generated.provider,
    model: generated.model,
  };
}

/**
 * True when the client asked for SSE progress (Accept or ?stream=1).
 * @param c - Hono request context.
 */
function wantsStream(c: Context): boolean {
  const accept = (c.req.header("accept") || "").toLowerCase();
  if (accept.includes("text/event-stream")) return true;
  const stream = c.req.query("stream");
  return stream === "1" || stream === "true";
}

export const diagramsRoutes = new Hono();

/**
 * POST /api/diagrams/from-image
 *
 * multipart/form-data:
 *   image  — required file (png/jpeg/webp/gif)
 *   title  — optional lab title hint
 *   notes  — optional instructor notes
 *
 * Also accepts JSON:
 *   { imageBase64, mimeType, title?, notes? }
 *
 * Streaming: send Accept: text/event-stream (or ?stream=1) for SSE progress
 * events (`progress`, `result`, `error`) instead of a single JSON body.
 */
diagramsRoutes.post("/from-image", async (c) => {
  const parsed = await parseImageRequest(c);
  if ("error" in parsed) {
    return c.json(
      { error: parsed.error, code: parsed.code },
      parsed.status,
    );
  }

  const { imageBase64, mimeType, title, notes } = parsed;
  const provider = createDiagramProvider();
  const stream = wantsStream(c);

  if (!stream) {
    const generated = await provider.generateLabYaml({
      image: { data: imageBase64, mimeType },
      title,
      notes,
    });
    const validated = validateLabYaml(generated.rawText);
    return c.json(buildSuccessPayload(generated, validated));
  }

  return streamSSE(c, async (sse) => {
    /**
     * Writes one SSE event and flushes.
     * @param event - SSE event name.
     * @param data - JSON-serializable payload.
     */
    async function send(event: string, data: unknown) {
      await sse.writeSSE({
        event,
        data: JSON.stringify(data),
      });
    }

    try {
      await send("progress", {
        message: `Using ${provider.name} provider…`,
      });

      const generated = await provider.generateLabYaml(
        {
          image: { data: imageBase64, mimeType },
          title,
          notes,
        },
        {
          onProgress: async ({ message }) => {
            await send("progress", { message });
          },
        },
      );

      const validated = validateLabYaml(generated.rawText);
      await send("result", buildSuccessPayload(generated, validated));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const code = (err as { code?: string } | null)?.code;
      await send("error", {
        error: error.message || "Internal server error",
        code,
      });
    }
  });
});
