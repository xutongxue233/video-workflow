import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const matched = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!matched) {
    return null;
  }

  const key = matched[1];
  let value = matched[2] ?? "";

  const quoted =
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"));
  if (quoted && value.length >= 2) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

export function loadEnvFileToProcess(input?: {
  cwd?: string;
  fileName?: string;
  override?: boolean;
}): boolean {
  const cwd = input?.cwd ?? process.cwd();
  const fileName = input?.fileName ?? ".env";
  const override = input?.override ?? false;
  const envPath = resolve(cwd, fileName);

  if (!existsSync(envPath)) {
    return false;
  }

  const content = readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }

    if (!override && typeof process.env[parsed.key] === "string") {
      continue;
    }

    process.env[parsed.key] = parsed.value;
  }

  return true;
}

