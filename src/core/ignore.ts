import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface IgnoreRule {
  ruleId?: string;
  pattern: string;
  regex: RegExp;
}

export interface IgnoreSyntaxError {
  line: number;
  raw: string;
  error: string;
}

export interface IgnoreConfig {
  rules: IgnoreRule[];
  syntaxErrors: IgnoreSyntaxError[];
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

export function validateIgnoreRule(pattern: string): string | null {
  if (/\*{3,}/.test(pattern)) {
    return "Consecutive asterisks (***+) are invalid glob syntax";
  }
  if (/\[[^\]]*$/.test(pattern)) {
    return "Unclosed character class bracket '[' in glob pattern";
  }
  if (/\{[^}]*$/.test(pattern)) {
    return "Unclosed brace '{' in glob pattern";
  }
  return null;
}

export function parseIgnoreContent(content: string): IgnoreConfig {
  const rules: IgnoreRule[] = [];
  const syntaxErrors: IgnoreSyntaxError[] = [];
  const lines = content.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex]!;
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    if (line.includes(":")) {
      const firstColon = line.indexOf(":");
      const ruleId = line.slice(0, firstColon).trim();
      const pattern = line.slice(firstColon + 1).trim();

      if (!ruleId) {
        syntaxErrors.push({
          line: lineIndex + 1,
          raw: line,
          error: "Missing rule identifier before colon",
        });
        continue;
      }

      if (!pattern) {
        syntaxErrors.push({
          line: lineIndex + 1,
          raw: line,
          error: "Missing file glob pattern after colon",
        });
        continue;
      }

      const patternErr = validateIgnoreRule(pattern);
      if (patternErr) {
        syntaxErrors.push({
          line: lineIndex + 1,
          raw: line,
          error: patternErr,
        });
        continue;
      }

      try {
        rules.push({
          ruleId,
          pattern,
          regex: globToRegex(pattern),
        });
      } catch (err) {
        syntaxErrors.push({
          line: lineIndex + 1,
          raw: line,
          error: `Invalid glob pattern: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      continue;
    }

    const patternErr = validateIgnoreRule(line);
    if (patternErr) {
      syntaxErrors.push({
        line: lineIndex + 1,
        raw: line,
        error: patternErr,
      });
      continue;
    }

    try {
      rules.push({
        pattern: line,
        regex: globToRegex(line),
      });
    } catch (err) {
      syntaxErrors.push({
        line: lineIndex + 1,
        raw: line,
        error: `Invalid glob pattern: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return { rules, syntaxErrors };
}

export const parseIgnoreFile = parseIgnoreContent;

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
    return { rules: [], syntaxErrors: [] };
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
