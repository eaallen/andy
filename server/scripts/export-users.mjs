/**
 * Export WorkOS AuthKit users as CSV (email outreach list).
 *
 * Usage:
 *   npm run export:users -w @andy/server > users.csv
 *
 * Reads WORKOS_API_KEY from the environment or server/.dev.vars.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WorkOS } from "@workos-inc/node";

const rootDir = dirname(fileURLToPath(import.meta.url));
const serverDir = join(rootDir, "..");

/**
 * Loads KEY=VALUE pairs from .dev.vars into process.env when unset.
 * @param filePath - Absolute path to a .dev.vars file.
 */
function loadDevVars(filePath) {
  if (!existsSync(filePath)) {
    return;
  }
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * Escapes a CSV field (quotes when needed).
 * @param value - Field value.
 */
function csvField(value) {
  const str = value == null ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

loadDevVars(join(serverDir, ".dev.vars"));

const apiKey = process.env.WORKOS_API_KEY;
if (!apiKey) {
  console.error(
    "WORKOS_API_KEY is required. Set it in the environment or server/.dev.vars.",
  );
  process.exit(1);
}

const workos = new WorkOS(apiKey);

const rows = [
  [
    "email",
    "first_name",
    "last_name",
    "email_verified",
    "created_at",
    "id",
  ].join(","),
];

let after = undefined;
do {
  const page = await workos.userManagement.listUsers({
    limit: 100,
    order: "desc",
    after,
  });
  for (const user of page.data) {
    rows.push(
      [
        csvField(user.email),
        csvField(user.firstName),
        csvField(user.lastName),
        csvField(user.emailVerified),
        csvField(user.createdAt),
        csvField(user.id),
      ].join(","),
    );
  }
  after = page.listMetadata?.after ?? undefined;
} while (after);

process.stdout.write(rows.join("\n") + "\n");
