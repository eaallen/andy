import { cpSync, mkdirSync, readdirSync, watch } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(serverRoot, "..");
const frontendRoot = path.resolve(repoRoot, "frontend");
const labsSrc = path.join(frontendRoot, "public", "labs");
const labsDest = path.join(serverRoot, "public", "labs");
const andySrc = path.join(frontendRoot, "dist", "andy.js");
const andyDest = path.join(serverRoot, "public", "andy.js");
const jsSrc = path.join(frontendRoot, "js");

const DEBOUNCE_MS = 200;

/** @type {ReturnType<typeof setTimeout>|null} */
let libTimer = null;
/** @type {ReturnType<typeof setTimeout>|null} */
let labsTimer = null;
let libBuilding = false;
let libQueued = false;

/**
 * Copies lab YAML files into server/public/labs.
 */
function copyLabs() {
  mkdirSync(labsDest, { recursive: true });
  const names = readdirSync(labsSrc).filter(function (name) {
    return name.endsWith(".yaml") || name.endsWith(".yml");
  });
  for (let i = 0; i < names.length; i += 1) {
    cpSync(path.join(labsSrc, names[i]), path.join(labsDest, names[i]));
  }
  console.log("[assets] synced " + names.length + " lab yaml file(s)");
}

/**
 * Copies the built IIFE bundle into server/public.
 */
function copyAndy() {
  mkdirSync(path.dirname(andyDest), { recursive: true });
  cpSync(andySrc, andyDest);
  console.log("[assets] synced andy.js");
}

/**
 * Rebuilds the frontend library and copies andy.js into server/public.
 */
function rebuildLib() {
  if (libBuilding) {
    libQueued = true;
    return;
  }
  libBuilding = true;
  console.log("[assets] rebuilding andy.js…");
  const child = spawn("npm", ["run", "build:lib", "-w", "@andy/frontend"], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: true,
  });
  child.on("exit", function (code) {
    libBuilding = false;
    if (code === 0) {
      try {
        copyAndy();
      } catch (err) {
        console.error("[assets] failed to copy andy.js:", err);
      }
    } else {
      console.error("[assets] build:lib exited with code " + code);
    }
    if (libQueued) {
      libQueued = false;
      rebuildLib();
    }
  });
}

/**
 * Schedules a function after quiet time; replaces any pending call.
 * @param {"lib"|"labs"} kind - Which debounce slot to use.
 * @param {() => void} fn - Work to run.
 */
function schedule(kind, fn) {
  if (kind === "lib") {
    if (libTimer) {
      clearTimeout(libTimer);
    }
    libTimer = setTimeout(function () {
      libTimer = null;
      fn();
    }, DEBOUNCE_MS);
    return;
  }
  if (labsTimer) {
    clearTimeout(labsTimer);
  }
  labsTimer = setTimeout(function () {
    labsTimer = null;
    fn();
  }, DEBOUNCE_MS);
}

/**
 * Ignores noisy editor temp files.
 * @param {string|null} filename - Changed path basename/relative from fs.watch.
 */
function isIgnorable(filename) {
  if (!filename) {
    return false;
  }
  return (
    filename.endsWith("~") ||
    filename.endsWith(".swp") ||
    filename.startsWith(".") ||
    filename.includes("node_modules")
  );
}

console.log("[assets] watching frontend/js and frontend/public/labs");

watch(jsSrc, { recursive: true }, function (_event, filename) {
  if (isIgnorable(filename)) {
    return;
  }
  schedule("lib", rebuildLib);
});

watch(labsSrc, { recursive: true }, function (_event, filename) {
  if (isIgnorable(filename)) {
    return;
  }
  schedule("labs", copyLabs);
});
