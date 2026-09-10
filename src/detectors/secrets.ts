import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { DiagnosticConfidence, PackageJsonData } from "../core/types.js";

export type SecretConfidence = DiagnosticConfidence;

export interface SecretFinding {
  ruleId: string;
  ruleName: string;
  file: string;
  line: number;
  column?: number;
  maskedMatch: string;
  severity: "critical" | "warning";
  confidence: SecretConfidence;
  suppressed: boolean;
  reason?: string;
}

export interface DangerousScriptFinding {
  scriptName: string;
  command: string;
  reason: string;
  severity: "critical" | "warning";
}

export interface SecurityScanOptions {
  maxFiles?: number;
  maxFileSize?: number;
}

export interface SecurityScan {
  secretFindings: SecretFinding[];
  dangerousScripts: DangerousScriptFinding[];
  filesDiscovered: number;
  filesScanned: number;
  filesSkipped: number;
  scanLimitReached: boolean;
}

export const KNOWN_DUMMY_CREDENTIALS = new Set([
  "AKIAIOSFODNN7EXAMPLE",
  "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  "sk_test_51Abcdefghijklmnopqrstuvwxyz",
  "sk-test-1234567890abcdefghijklmnopqrstuvwxyz",
  "example-secret",
  "test-secret",
  "dummy-key",
  "dummy-token",
  "dummy_token",
  "your-api-key-here",
  "placeholder-api-key",
  "1234567890abcdef",
]);

export function calculateShannonEntropy(str: string): number {
  if (!str || str.length === 0) return 0;
  const frequencies = new Map<string, number>();
  for (const char of str) {
    frequencies.set(char, (frequencies.get(char) ?? 0) + 1);
  }
  let entropy = 0;
  const len = str.length;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function evaluateConfidence(
  _ruleId: string,
  matchedSecret: string,
  filePath: string,
): { confidence: SecretConfidence; suppressed: boolean; reason: string } {
  const lowerMatch = matchedSecret.toLowerCase();

  // Check known dummy credentials & example patterns
  if (
    KNOWN_DUMMY_CREDENTIALS.has(matchedSecret) ||
    lowerMatch.includes("dummy") ||
    lowerMatch.includes("example") ||
    lowerMatch.includes("placeholder") ||
    lowerMatch.includes("your-key") ||
    lowerMatch.includes("your_key") ||
    lowerMatch.includes("your-token") ||
    lowerMatch.includes("your_token") ||
    lowerMatch.startsWith("sk_test_") ||
    lowerMatch.endsWith("example")
  ) {
    return {
      confidence: "suppressed",
      suppressed: true,
      reason: "Known provider example or placeholder credential",
    };
  }

  // Check file path context (docs, examples, samples)
  const normPath = filePath.toLowerCase().replace(/\\/g, "/");
  const isDocOrExample =
    normPath.includes("example") ||
    normPath.includes("sample") ||
    normPath.includes("doc/") ||
    normPath.includes("docs/") ||
    normPath.endsWith(".md");

  const entropy = calculateShannonEntropy(matchedSecret);

  if (isDocOrExample) {
    return {
      confidence: "medium",
      suppressed: false,
      reason: "Matched in documentation or example file",
    };
  }

  // Low entropy check (repeated characters or predictable sequence)
  if (entropy < 2.6) {
    return {
      confidence: "low",
      suppressed: false,
      reason: "Low character entropy suggests generated placeholder or template",
    };
  }

  return {
    confidence: "high",
    suppressed: false,
    reason: "Valid provider prefix, pattern match, and high character entropy",
  };
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
  ".ini",
  ".xml",
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".env.test",
  ".py",
  ".sh",
  ".bash",
  ".zsh",
  ".ps1",
  ".pem",
  ".key",
  ".cer",
  ".p12",
  ".pfx",
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
    id: "secret.google-ai",
    name: "Google Gemini / Cloud API Key",
    pattern: /\b(AIzaSy[a-zA-Z0-9_-]{30,35})\b/g,
    severity: "critical",
  },
  {
    id: "secret.anthropic-key",
    name: "Anthropic Claude API Key",
    pattern: /\b(sk-ant-api03-[a-zA-Z0-9_-]{86,})\b/g,
    severity: "critical",
  },
  {
    id: "secret.huggingface-token",
    name: "HuggingFace Access Token",
    pattern: /\b(hf_[a-zA-Z0-9]{34,})\b/g,
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
    id: "secret.discord-token",
    name: "Discord Bot Token",
    pattern: /\b([MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27,})\b/g,
    severity: "critical",
  },
  {
    id: "secret.telegram-token",
    name: "Telegram Bot Token",
    pattern: /\b(\d{8,10}:[a-zA-Z0-9_-]{32,38})\b/g,
    severity: "critical",
  },
  {
    id: "secret.jwt-token",
    name: "JSON Web Token (JWT)",
    pattern: /\b(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)\b/g,
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

interface WalkResult {
  files: string[];
  filesDiscovered: number;
  filesSkipped: number;
  scanLimitReached: boolean;
}

async function walkSourceFiles(root: string, maxFiles: number): Promise<WalkResult> {
  const results: string[] = [];
  let filesDiscovered = 0;
  let filesSkipped = 0;
  let scanLimitReached = false;

  async function visit(dir: string): Promise<void> {
    if (results.length >= maxFiles) {
      scanLimitReached = true;
      return;
    }
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= maxFiles) {
        scanLimitReached = true;
        if (entry.isFile()) {
          filesDiscovered += 1;
          filesSkipped += 1;
        }
        continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          await visit(full);
        }
      } else if (entry.isFile()) {
        filesDiscovered += 1;
        const name = entry.name.toLowerCase();
        if (
          name.endsWith(".test.ts") ||
          name.endsWith(".spec.ts") ||
          name.endsWith(".test.js") ||
          name.endsWith(".spec.js")
        ) {
          filesSkipped += 1;
          continue;
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (
          !SKIP_FILES.has(entry.name) &&
          (SCANNABLE_EXTENSIONS.has(ext) || entry.name.startsWith(".env"))
        ) {
          results.push(full);
        } else {
          filesSkipped += 1;
        }
      }
    }
  }

  await visit(root);
  return { files: results, filesDiscovered, filesSkipped, scanLimitReached };
}

export async function scanSecrets(
  root: string,
  packageJson: PackageJsonData | null,
  options: SecurityScanOptions = {},
): Promise<SecurityScan> {
  const secretFindings: SecretFinding[] = [];
  const dangerousScripts: DangerousScriptFinding[] = [];
  const maxFiles = options.maxFiles ?? MAX_FILES;
  const maxFileSize = options.maxFileSize ?? MAX_FILE_BYTES;

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
  const walk = await walkSourceFiles(root, maxFiles);
  let filesScanned = 0;
  let skippedBytes = 0;

  for (const file of walk.files) {
    let text: string;
    try {
      const buffer = await readFile(file);
      if (buffer.byteLength > maxFileSize) {
        skippedBytes += 1;
        continue;
      }
      text = buffer.toString("utf8");
      filesScanned += 1;
    } catch {
      skippedBytes += 1;
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
          const column = match.index + 1;
          const evaluation = evaluateConfidence(rule.id, matchedSecret, relPath);

          secretFindings.push({
            ruleId: rule.id,
            ruleName: rule.name,
            file: relPath,
            line: lineIndex + 1,
            column,
            maskedMatch: maskSecret(matchedSecret),
            severity: rule.severity,
            confidence: evaluation.confidence,
            suppressed: evaluation.suppressed,
            reason: evaluation.reason,
          });
        }
      }
    }
  }

  return {
    secretFindings,
    dangerousScripts,
    filesDiscovered: walk.filesDiscovered,
    filesScanned,
    filesSkipped: walk.filesSkipped + skippedBytes,
    scanLimitReached: walk.scanLimitReached,
  };
}
