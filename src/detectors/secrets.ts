import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { PackageJsonData } from "../core/types.js";

export interface SecretFinding {
  ruleId: string;
  ruleName: string;
  file: string;
  line: number;
  maskedMatch: string;
  severity: "critical" | "warning";
}

export interface DangerousScriptFinding {
  scriptName: string;
  command: string;
  reason: string;
  severity: "critical" | "warning";
}

export interface SecurityScan {
  secretFindings: SecretFinding[];
  dangerousScripts: DangerousScriptFinding[];
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".cache",
  ".turbo",
  ".vercel",
  ".yarn",
  ".out",
  "tests",
  "test",
  "__tests__",
  "fixtures",
]);

const SKIP_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
  ".env.example",
  "report.html",
  "results.sarif",
]);

const SCANNABLE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".env.test",
  ".py",
  ".sh",
  ".bash",
  ".md",
  ".html",
  ".sql",
]);

const MAX_FILES = 5000;
const MAX_FILE_BYTES = 1_000_000;

interface SecretRule {
  id: string;
  name: string;
  pattern: RegExp;
  severity: "critical" | "warning";
}

const SECRET_RULES: SecretRule[] = [
  {
    id: "secret.aws-key",
    name: "AWS Access Key",
    pattern: /\b((?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16})\b/g,
    severity: "critical",
  },
  {
    id: "secret.openai-key",
    name: "OpenAI API Key",
    pattern: /\b(sk-[a-zA-Z0-9]{20,}|sk-proj-[a-zA-Z0-9_-]{20,})\b/g,
    severity: "critical",
  },
  {
    id: "secret.github-token",
    name: "GitHub Token",
    pattern: /\b(ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{22,82})\b/g,
    severity: "critical",
  },
  {
    id: "secret.stripe-key",
    name: "Stripe Secret Key",
    pattern: /\b(sk_live_[0-9a-zA-Z]{24,})\b/g,
    severity: "critical",
  },
  {
    id: "secret.slack-token",
    name: "Slack Token / Webhook",
    pattern: /\b(xox[baprs]-[0-9a-zA-Z]{10,48})\b|https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]+\/B[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+/g,
    severity: "critical",
  },
  {
    id: "secret.private-key",
    name: "Private Key",
    pattern: /-----BEGIN (?:RSA|OPENSSH|DSA|EC|PGP)?\s*PRIVATE KEY-----/g,
    severity: "critical",
  },
  {
    id: "secret.database-url",
    name: "Database Credentials in URL",
    pattern: /\b(?:postgres|postgresql|mysql|mongodb|mongodb\+srv|redis):\/\/[a-zA-Z0-9_]+:([a-zA-Z0-9_!#$%&*+\-.:=?@~]{4,})@[a-zA-Z0-9_.-]+/g,
    severity: "critical",
  },
];

const DANGEROUS_SCRIPT_PATTERNS: Array<{ pattern: RegExp; reason: string; severity: "critical" | "warning" }> = [
  {
    pattern: /curl\s+.*?\|\s*(?:ba)?sh/i,
    reason: "Pipes downloaded curl content directly into a shell interpreter",
    severity: "critical",
  },
  {
    pattern: /wget\s+.*?\|\s*(?:ba)?sh/i,
    reason: "Pipes downloaded wget content directly into a shell interpreter",
    severity: "critical",
  },
  {
    pattern: /rm\s+-rf\s+(?:\/|\/\*|~|\$HOME)(?:\s|$)/i,
    reason: "Attempts to delete root or home directory recursively",
    severity: "critical",
  },
  {
    pattern: /chmod\s+(?:-R\s+)?777\b/i,
    reason: "Sets overly permissive 777 permissions",
    severity: "warning",
  },
  {
    pattern: /powershell\s+-(?:enc|encodedcommand)\b/i,
    reason: "Executes obfuscated base64 PowerShell command",
    severity: "warning",
  },
];

export function maskSecret(secret: string): string {
  if (secret.length <= 8) {
    return "****";
  }
  const prefix = secret.slice(0, 4);
  const suffix = secret.slice(-3);
  return `${prefix}****${suffix}`;
}

async function walkSourceFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  let count = 0;

  async function visit(dir: string): Promise<void> {
    if (count >= MAX_FILES) {
      return;
    }
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (count >= MAX_FILES) {
        return;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          await visit(full);
        }
      } else if (entry.isFile()) {
        const name = entry.name.toLowerCase();
        if (
          name.endsWith(".test.ts") ||
          name.endsWith(".spec.ts") ||
          name.endsWith(".test.js") ||
          name.endsWith(".spec.js")
        ) {
          continue;
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (
          !SKIP_FILES.has(entry.name) &&
          (SCANNABLE_EXTENSIONS.has(ext) || entry.name.startsWith(".env"))
        ) {
          results.push(full);
          count += 1;
        }
      }
    }
  }

  await visit(root);
  return results;
}

export async function scanSecrets(root: string, packageJson: PackageJsonData | null): Promise<SecurityScan> {
  const secretFindings: SecretFinding[] = [];
  const dangerousScripts: DangerousScriptFinding[] = [];

  // 1. Scan scripts in package.json
  if (packageJson?.scripts) {
    for (const [scriptName, scriptCommand] of Object.entries(packageJson.scripts)) {
      if (typeof scriptCommand !== "string") continue;
      for (const { pattern, reason, severity } of DANGEROUS_SCRIPT_PATTERNS) {
        if (pattern.test(scriptCommand)) {
          dangerousScripts.push({
            scriptName,
            command: scriptCommand,
            reason,
            severity,
          });
        }
      }
    }
  }

  // 2. Scan source files
  const files = await walkSourceFiles(root);

  for (const file of files) {
    let text: string;
    try {
      const buffer = await readFile(file);
      if (buffer.byteLength > MAX_FILE_BYTES) {
        continue;
      }
      text = buffer.toString("utf8");
    } catch {
      continue;
    }

    const relPath = path.relative(root, file).replace(/\\/g, "/");
    const lines = text.split(/\r?\n/);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex]!;
      if (line.trim().length === 0) continue;

      for (const rule of SECRET_RULES) {
        const regex = new RegExp(rule.pattern.source, "g");
        let match: RegExpExecArray | null;
        while ((match = regex.exec(line)) !== null) {
          const matchedSecret = match[1] || match[0];
          // Skip placeholders
          if (
            matchedSecret.includes("dummy") ||
            matchedSecret.includes("example") ||
            matchedSecret.includes("placeholder") ||
            matchedSecret.includes("your-key")
          ) {
            continue;
          }
          secretFindings.push({
            ruleId: rule.id,
            ruleName: rule.name,
            file: relPath,
            line: lineIndex + 1,
            maskedMatch: maskSecret(matchedSecret),
            severity: rule.severity,
          });
        }
      }
    }
  }

  return { secretFindings, dangerousScripts };
}
