import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PackageJsonData } from "../core/types.js";

export interface PortSource {
  port: number;
  source: string;
}

async function readOr(root: string, name: string): Promise<string | null> {
  try {
    return await readFile(path.join(root, name), "utf8");
  } catch {
    return null;
  }
}

function portFromEnvContent(text: string): number | null {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const match = line.match(/^PORT\s*=\s*"?(\d{1,5})"?$/);
    if (match) {
      const port = Number(match[1]);
      if (port > 0 && port <= 65535) {
        return port;
      }
    }
  }
  return null;
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

export async function detectPorts(root: string, packageJson: PackageJsonData | null): Promise<PortSource[]> {
  const sources: PortSource[] = [];
  const add = (port: number, source: string): void => {
    if (isValidPort(port)) {
      sources.push({ port, source });
    }
  };

  const [envRaw, localRaw, exampleRaw] = await Promise.all([
    readOr(root, ".env"),
    readOr(root, ".env.local"),
    readOr(root, ".env.example"),
  ]);

  for (const [raw, name] of [
    [envRaw, ".env"],
    [localRaw, ".env.local"],
    [exampleRaw, ".env.example"],
  ] as const) {
    if (raw !== null) {
      const port = portFromEnvContent(raw);
      if (port !== null) {
        add(port, name);
      }
    }
  }

  const configPort = (packageJson?.config as { port?: unknown } | undefined)?.port;
  if (typeof configPort === "number") {
    add(configPort, "package.json config.port");
  }

  return sources.filter((source, index) => sources.findIndex((other) => other.port === source.port) === index);
}