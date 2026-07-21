import { Agent } from "@cursor/sdk";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { env } from "@/config/env.js";
import { buildLabYamlPrompt } from "@/prompts/lab-yaml.js";
import type {
  DiagramAiProvider,
  DiagramGenerationRequest,
  DiagramGenerationResult,
} from "@/ai/types.js";

/**
 * Cursor SDK provider — short-term path using Cursor-hosted models
 * (including Grok 4.5 when available on the account).
 *
 * Registers a custom tool `submit_andy_lab_yaml` so the agent returns
 * structured YAML instead of editing the workspace.
 */
export class CursorDiagramProvider implements DiagramAiProvider {
  readonly name = "cursor" as const;

  async generateLabYaml(
    request: DiagramGenerationRequest,
  ): Promise<DiagramGenerationResult> {
    if (!env.cursorApiKey) {
      throw Object.assign(new Error("CURSOR_API_KEY is not configured."), {
        status: 503,
        code: "missing_cursor_api_key",
      });
    }

    const workspace = await mkdtemp(path.join(tmpdir(), "andy-cursor-"));
    let submittedYaml = "";

    try {
      await writeFile(
        path.join(workspace, "README.md"),
        "Temporary workspace for Andy diagram→YAML generation. Do not edit files.\n",
        "utf8",
      );

      const basePrompt = buildLabYamlPrompt({
        title: request.title,
        notes: request.notes,
      });

      const prompt = `${basePrompt}

## Delivery
When you have the complete YAML, call the tool submit_andy_lab_yaml exactly once
with the full document in the yaml argument.
Do not write or edit files. Do not use markdown fences in the tool argument.`;

      await using agent = await Agent.create({
        apiKey: env.cursorApiKey,
        model: { id: env.cursorModel },
        mode: "agent",
        local: {
          cwd: workspace,
          sandboxOptions: { enabled: true },
          customTools: {
            submit_andy_lab_yaml: {
              description:
                "Submit the final Andy lab YAML document. Call exactly once when done analyzing the diagram.",
              inputSchema: {
                type: "object",
                properties: {
                  yaml: {
                    type: "string",
                    description: "Complete Andy lab YAML document (no markdown fences)",
                  },
                },
                required: ["yaml"],
              },
              execute: (args) => {
                submittedYaml = String(args.yaml ?? "");
                return {
                  ok: true,
                  message: "YAML received by Andy server.",
                };
              },
            },
          },
        },
      });

      const run = await agent.send({
        text: prompt,
        images: [
          {
            data: request.image.data,
            mimeType: request.image.mimeType,
          },
        ],
      });

      const result = await run.wait();

      if (result.status === "error") {
        const detail = result.error?.message || "Cursor agent run failed.";
        throw Object.assign(new Error(detail), {
          status: 502,
          code: result.error?.code || "cursor_run_failed",
        });
      }

      const rawText = (submittedYaml || result.result || "").trim();
      if (!rawText) {
        throw Object.assign(
          new Error(
            "Cursor agent finished without submitting YAML. Try another model or switch AI_PROVIDER=gemini.",
          ),
          { status: 502, code: "cursor_empty_result" },
        );
      }

      const modelId = result.model?.id ?? env.cursorModel;

      return {
        yaml: rawText,
        provider: "cursor",
        model: modelId,
        rawText,
      };
    } finally {
      await rm(workspace, { recursive: true, force: true }).catch(() => {});
    }
  }
}
