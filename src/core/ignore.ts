import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface IgnoreRule {
  ruleId?: string;
  pattern: string;
  regex: RegExp;
}

export interface IgnoreConfig {
  rules: IgnoreRule[];
}

function globToRegex(glob: string): RegExp {
  const normalized = glob.replace(/\\/g, "/").trim();
  // Escape special regex characters except * and ?
  let regexStr = "^";
  let i = 0;
  while (i < normalized.length) {
    const c = normalized[i];
    if (c === "*" && normalized[i + 1] === "*") {
      if (normalized[i + 2] === "/") {
        regexStr += "(?:.*/)?";
        i += 3;
      } else {
        regexStr += ".*";
        i += 2;
      }
    } else if (c === "*") {
      regexStr += "[^/]*";
      i += 1;
    } else if (c === "?") {
      regexStr += "[^/]";
      i += 1;
    } else if (["[", "]", "(", ")", "{", "}", ".", "+", "^", "$", "|"].includes(c!)) {
      regexStr += `\\${c}`;
      i += 1;
    } else {
      regexStr += c;
      i += 1;
    }
  }
  regexStr += "$";
  return new RegExp(regexStr, "i");
}

export function parseIgnoreContent(content: string): IgnoreConfig {
  const rules: IgnoreRule[] = [];
  const lines = content.split(/\r?\n/);

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    if (line.includes(":")) {
      const firstColon = line.indexOf(":");
      const ruleId = line.slice(0, firstColon).trim();
      const pattern = line.slice(firstColon + 1).trim();
      if (ruleId && pattern) {
        rules.push({
          ruleId,
          pattern,
          regex: globToRegex(pattern),
        });
        continue;
      }
    }

    rules.push({
      pattern: line,
      regex: globToRegex(line),
    });
  }

  return { rules };
}

export async function loadIgnoreConfig(rootOrFile: string): Promise<IgnoreConfig> {
  let ignorePath = rootOrFile;
  try {
    const stats = await stat(rootOrFile);
    if (stats.isDirectory()) {
      ignorePath = path.join(rootOrFile, ".repodoctorignore");
    }
    const text = await readFile(ignorePath, "utf8");
    return parseIgnoreContent(text);
  } catch {
    return { rules: [] };
  }
}

export function isDiagnosticIgnored(config: IgnoreConfig, relPath: string, ruleId?: string): boolean {
  const normalizedPath = relPath.replace(/\\/g, "/");

  for (const rule of config.rules) {
    // If the rule specifies a ruleId, it must match
    if (rule.ruleId && ruleId && rule.ruleId !== ruleId && !ruleId.startsWith(rule.ruleId)) {
      continue;
    }

    // Check glob match against normalized path or filename
    if (rule.regex.test(normalizedPath) || rule.regex.test(path.basename(normalizedPath))) {
      return true;
    }
  }

  return false;
}

const DEFAULT_IGNORE_TEMPLATE = `# .repodoctorignore — RepoDoctor Suppressions & Exclusions
# Ignore directories or files by glob pattern
tests/fixtures/**
examples/**
docs/**

# Rule-specific suppression format: <rule-id>:<file-pattern>
# secret.aws-key:examples/aws.ts
# framework.tailwind.missing-config:packages/legacy-app/**
`;

export async function createDefaultIgnoreFile(root: string): Promise<{ created: boolean; path: string }> {
  const ignorePath = path.join(root, ".repodoctorignore");
  try {
    await stat(ignorePath);
    return { created: false, path: ignorePath };
  } catch {
    await writeFile(ignorePath, DEFAULT_IGNORE_TEMPLATE, "utf8");
    return { created: true, path: ignorePath };
  }
}
