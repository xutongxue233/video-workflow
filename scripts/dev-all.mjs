import { spawn } from "node:child_process";
import process from "node:process";

import { buildNpmSpawnSpec } from "./dev-all.shared.mjs";

function runNpmScript(name) {
  const spec = buildNpmSpawnSpec(name);
  return spawn(spec.command, spec.args, spec.options);
}

const worker = runNpmScript("worker");
const web = runNpmScript("dev");

const children = [worker, web];
let exiting = false;

function shutdown(code = 0) {
  if (exiting) {
    return;
  }

  exiting = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

for (const child of children) {
  child.on("error", () => shutdown(1));
  child.on("exit", (code) => {
    if (exiting) {
      return;
    }

    shutdown(code ?? 1);
  });
}