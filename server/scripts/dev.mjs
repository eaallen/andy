import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @type {import("node:child_process").ChildProcess[]} */
const children = [];
let shuttingDown = false;

/**
 * Spawns a child with inherited stdio and tracks it for shutdown.
 * @param {string} command - Executable.
 * @param {string[]} args - Arguments.
 * @param {string} [cwd] - Working directory (defaults to server root).
 */
function run(command, args, cwd) {
  const child = spawn(command, args, {
    cwd: cwd || serverRoot,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  children.push(child);
  return child;
}

/**
 * Stops all tracked children and exits.
 * @param {number} [code] - Process exit code.
 */
function shutdown(code) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  process.exit(typeof code === "number" ? code : 0);
}

process.on("SIGINT", function () {
  shutdown(0);
});
process.on("SIGTERM", function () {
  shutdown(0);
});

const watcher = run(process.execPath, [path.join(serverRoot, "scripts", "watch-assets.mjs")]);
const vite = run("vite", []);

watcher.on("exit", function (code) {
  if (!shuttingDown) {
    console.error("[dev] asset watcher exited unexpectedly");
    shutdown(code || 1);
  }
});

vite.on("exit", function (code) {
  shutdown(code || 0);
});
