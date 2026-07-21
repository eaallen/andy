import { Hono } from "hono";
import { env } from "@/config/env.js";
import { createDiagramProvider } from "@/ai/provider.js";
import { validateLabYaml } from "@/lab/validate.js";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

function normalizeMime(mime: string): string {
  const value = (mime || "").toLowerCase().split(";")[0]!.trim();
  if (value === "image/jpg") {
    return "image/jpeg";
  }
  return value;
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
 */
diagramsRoutes.post("/from-image", async (c) => {
  const contentType = c.req.header("content-type") || "";

  let imageBase64 = "";
  let mimeType = "";
  let title: string | undefined;
  let notes: string | undefined;

  if (contentType.includes("multipart/form-data")) {
    const body = await c.req.parseBody({ all: true });
    const file = body.image;

    if (!(file instanceof File)) {
      return c.json(
        {
          error: 'Expected multipart field "image" as a file.',
          code: "missing_image",
        },
        400,
      );
    }

    if (file.size > env.maxUploadBytes) {
      return c.json(
        {
          error: `Image exceeds max size of ${env.maxUploadBytes} bytes.`,
          code: "image_too_large",
        },
        413,
      );
    }

    mimeType = normalizeMime(file.type || "application/octet-stream");
    if (!ALLOWED_MIME.has(mimeType)) {
      return c.json(
        {
          error: `Unsupported image type "${mimeType}". Use png, jpeg, webp, or gif.`,
          code: "unsupported_mime",
        },
        400,
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    imageBase64 = buffer.toString("base64");
    title = typeof body.title === "string" ? body.title : undefined;
    notes = typeof body.notes === "string" ? body.notes : undefined;
  } else {
    const json = await c.req.json<{
      imageBase64?: string;
      mimeType?: string;
      title?: string;
      notes?: string;
    }>();

    if (!json.imageBase64 || !json.mimeType) {
      return c.json(
        {
          error: "JSON body requires imageBase64 and mimeType.",
          code: "missing_image",
        },
        400,
      );
    }

    // Allow data-URL prefix.
    imageBase64 = json.imageBase64.replace(/^data:[^;]+;base64,/, "");
    mimeType = normalizeMime(json.mimeType);
    title = json.title;
    notes = json.notes;

    if (!ALLOWED_MIME.has(mimeType)) {
      return c.json(
        {
          error: `Unsupported image type "${mimeType}". Use png, jpeg, webp, or gif.`,
          code: "unsupported_mime",
        },
        400,
      );
    }

    const approxBytes = Math.floor((imageBase64.length * 3) / 4);
    if (approxBytes > env.maxUploadBytes) {
      return c.json(
        {
          error: `Image exceeds max size of ${env.maxUploadBytes} bytes.`,
          code: "image_too_large",
        },
        413,
      );
    }
  }

  const provider = createDiagramProvider();
  const generated = await provider.generateLabYaml({
    image: { data: imageBase64, mimeType },
    title,
    notes,
  });

  const validated = validateLabYaml(generated.rawText);

  return c.json({
    yaml: validated.yaml,
    lab: validated.lab,
    warnings: validated.issues
      .filter((i) => i.level === "warning")
      .map((i) => i.message),
    provider: generated.provider,
    model: generated.model,
  });
});
