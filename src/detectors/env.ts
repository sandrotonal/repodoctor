import { readFile } from "node:fs/promises";
import path from "node:path";

export interface EnvState {
  envFileExists: boolean;
  exampleExists: boolean;
  envKeys: string[];
  exampleKeys: string[];
  envGitIgnored: boolean;
}

export function parseEnvKeys(text: string): string[] {
  const keys: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) {
      keys.push(match[1]!);
    }
  }
  return keys;
}

export function gitIgnoreMatchesEnv(content: string): boolean {
  return content
    .split(/\r?\n/)
    .some((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0 || trimmed.startsWith("#")) {
        return false;
      }
      return /\.env/.test(trimmed);
    });
}

async function readOr(root: string, name: string): Promise<string | null> {
  try {
    return await readFile(path.join(root, name), "utf8");
  } catch {
    return null;
  }
}

export async function readEnvState(root: string): Promise<EnvState> {
  const [envRaw, localRaw, exampleRaw, gitignoreRaw] = await Promise.all([
    readOr(root, ".env"),
    readOr(root, ".env.local"),
    readOr(root, ".env.example"),
    readOr(root, ".gitignore"),
  ]);

  return {
    envFileExists: envRaw !== null || localRaw !== null,
    exampleExists: exampleRaw !== null,
    envKeys: [...new Set([...(envRaw ? parseEnvKeys(envRaw) : []), ...(localRaw ? parseEnvKeys(localRaw) : [])])],
    exampleKeys: exampleRaw ? [...new Set(parseEnvKeys(exampleRaw))] : [],
    envGitIgnored: gitignoreRaw !== null && gitIgnoreMatchesEnv(gitignoreRaw),
  };
}