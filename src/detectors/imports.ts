import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface ImportScan {
  packagesUsed: Set<string>;
  packagesImported: Set<string>;
}

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts", ".vue", ".svelte"]);
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
]);
const MAX_FILES = 5000;
const MAX_FILE_BYTES = 1_000_000;

const SPECIFIER_PATTERNS: RegExp[] = [
  /import\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g,
  /export\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g,
  /import\s*\(\s*["']([^"']+)["']\s*\)/g,
  /require\(\s*["']([^"']+)["']\s*\)/g,
  /from\s*["']([^"']+)["']/g,
];

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
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        results.push(full);
        count += 1;
      }
    }
  }

  await visit(root);
  return results;
}

function extractSpecifiers(text: string): string[] {
  const specifiers: string[] = [];
  for (const pattern of SPECIFIER_PATTERNS) {
    const local = new RegExp(pattern.source, "g");
    let match;
    while ((match = local.exec(text)) !== null) {
      specifiers.push(match[1]!);
    }
  }
  return specifiers;
}

export function packageNameFromSpecifier(specifier: string): string | null {
  if (specifier.length === 0) {
    return null;
  }
  if (specifier.startsWith(".") || specifier === "..") {
    return null;
  }
  if (specifier.startsWith("/") || specifier.startsWith("#") || specifier.startsWith("~")) {
    return null;
  }
  if (specifier.startsWith("node:") || specifier.startsWith("virtual:")) {
    return null;
  }
  const segments = specifier.split("/");
  if (specifier.startsWith("@") && specifier.indexOf("/") !== -1) {
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : specifier;
  }
  return segments[0]!;
}

export async function scanImports(root: string): Promise<ImportScan> {
  const packagesUsed = new Set<string>();
  const packagesImported = new Set<string>();
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

    for (const specifier of extractSpecifiers(text)) {
      const packageName = packageNameFromSpecifier(specifier);
      if (packageName === null) {
        continue;
      }
      packagesUsed.add(packageName);
      packagesImported.add(packageName);
    }
  }

  return { packagesUsed, packagesImported };
}