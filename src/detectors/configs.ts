import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

export interface TsConfigInfo {
  exists: boolean;
  valid: boolean;
  parseError: string | null;
  strict: boolean;
  skipLibCheck: boolean;
  target?: string;
  hasTsFiles: boolean;
}

export interface DockerInfo {
  hasDockerfile: boolean;
  dockerfileNames: string[];
  hasDockerignore: boolean;
  ignoresNodeModules: boolean;
  ignoresEnv: boolean;
  ignoresGit: boolean;
}

export interface ExposedFile {
  name: string;
  reason: string;
  severity: "critical" | "warning";
}

export interface ConfigsState {
  typescript: TsConfigInfo;
  docker: DockerInfo;
  exposedFiles: ExposedFile[];
}

const SENSITIVE_FILE_PATTERNS: Array<{ pattern: RegExp; reason: string; severity: "critical" | "warning" }> = [
  { pattern: /^id_(?:rsa|dsa|ed25519|ecdsa)(?:\.pub)?$/i, reason: "SSH private or public key stored in project directory", severity: "critical" },
  { pattern: /\.(?:pem|key|pfx|pkcs12|keystore|jks)$/i, reason: "Cryptographic private key or certificate bundle", severity: "critical" },
  { pattern: /^\.npmrc$/i, reason: "NPM config file may contain registry auth tokens", severity: "warning" },
];

async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return s.isFile();
  } catch {
    return false;
  }
}

function stripJsonComments(jsonString: string): string {
  return jsonString
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

export async function detectConfigs(root: string): Promise<ConfigsState> {
  // 1. Detect Root Files
  let rootEntries: string[] = [];
  try {
    rootEntries = await readdir(root);
  } catch {
    rootEntries = [];
  }

  // 2. TypeScript Detection
  const tsConfigPath = path.join(root, "tsconfig.json");
  const hasTsConfig = await checkFileExists(tsConfigPath);
  let tsValid = false;
  let tsParseError: string | null = null;
  let tsStrict = false;
  let tsSkipLibCheck = false;
  let tsTarget: string | undefined;

  if (hasTsConfig) {
    try {
      const raw = await readFile(tsConfigPath, "utf8");
      const cleaned = stripJsonComments(raw);
      const parsed = JSON.parse(cleaned) as {
        compilerOptions?: {
          strict?: boolean;
          skipLibCheck?: boolean;
          target?: string;
        };
      };
      tsValid = true;
      tsStrict = Boolean(parsed.compilerOptions?.strict);
      tsSkipLibCheck = Boolean(parsed.compilerOptions?.skipLibCheck);
      tsTarget = parsed.compilerOptions?.target;
    } catch {
      tsValid = false;
      tsParseError = "tsconfig.json contains invalid JSON or unsupported syntax.";
    }
  }

  // Check if any .ts / .tsx files exist in root or src
  let hasTsFiles = false;
  try {
    for (const name of rootEntries) {
      if (name.endsWith(".ts") || name.endsWith(".tsx")) {
        hasTsFiles = true;
        break;
      }
    }
    if (!hasTsFiles) {
      const srcEntries = await readdir(path.join(root, "src")).catch(() => []);
      for (const name of srcEntries) {
        if (name.endsWith(".ts") || name.endsWith(".tsx")) {
          hasTsFiles = true;
          break;
        }
      }
    }
  } catch {
    // ignore
  }

  // 3. Docker Detection
  const dockerfileNames = rootEntries.filter((f) => /^Dockerfile(?:\..+)?$/i.test(f));
  const hasDockerfile = dockerfileNames.length > 0;
  const hasDockerignore = rootEntries.some((f) => f === ".dockerignore");

  let ignoresNodeModules = false;
  let ignoresEnv = false;
  let ignoresGit = false;

  if (hasDockerignore) {
    try {
      const raw = await readFile(path.join(root, ".dockerignore"), "utf8");
      const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("#"));
      ignoresNodeModules = lines.some((l) => l.includes("node_modules"));
      ignoresEnv = lines.some((l) => l.includes(".env"));
      ignoresGit = lines.some((l) => l.includes(".git"));
    } catch {
      // ignore
    }
  }

  // 4. Sensitive Exposed Files
  const exposedFiles: ExposedFile[] = [];
  for (const entry of rootEntries) {
    for (const { pattern, reason, severity } of SENSITIVE_FILE_PATTERNS) {
      if (pattern.test(entry)) {
        if (entry === ".npmrc") {
          // Check if .npmrc actually has authToken
          try {
            const npmrcContent = await readFile(path.join(root, ".npmrc"), "utf8");
            if (npmrcContent.includes("_authToken") || npmrcContent.includes("auth=")) {
              exposedFiles.push({
                name: entry,
                reason: "Contains hardcoded registry authentication tokens",
                severity: "critical",
              });
            }
          } catch {
            // ignore
          }
        } else {
          exposedFiles.push({
            name: entry,
            reason,
            severity,
          });
        }
      }
    }
  }

  return {
    typescript: {
      exists: hasTsConfig,
      valid: tsValid,
      parseError: tsParseError,
      strict: tsStrict,
      skipLibCheck: tsSkipLibCheck,
      target: tsTarget,
      hasTsFiles,
    },
    docker: {
      hasDockerfile,
      dockerfileNames,
      hasDockerignore,
      ignoresNodeModules,
      ignoresEnv,
      ignoresGit,
    },
    exposedFiles,
  };
}
