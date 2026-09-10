import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

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

function outsideStringRegions(text: string): Uint8Array {
  const outside = new Uint8Array(text.length).fill(1);
  let i = 0;
  const n = text.length;
  while (i < n) {
    const start = text[i]!;
    if (start !== '"' && start !== "'" && start !== "`") {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < n) {
      const current = text[j]!;
      if (current === "\\") {
        j += 2;
        continue;
      }
      if (current === start) {
        break;
      }
      j += 1;
    }
    for (let k = i; k <= j && k < n; k += 1) {
      outside[k] = 0;
    }
    i = j < n ? j + 1 : n;
  }
  return outside;
}

function extractSpecifiersRegex(text: string): string[] {
  const outside = outsideStringRegions(text);
  const specifiers: string[] = [];
  for (const pattern of SPECIFIER_PATTERNS) {
    const local = new RegExp(pattern.source, "g");
    let match;
    while ((match = local.exec(text)) !== null) {
      if (outside[match.index] === 1) {
        specifiers.push(match[1]!);
      }
    }
  }
  return specifiers;
}

export function extractSpecifiers(text: string, filePath: string = "source.ts"): string[] {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".vue" || ext === ".svelte") {
    return extractSpecifiersRegex(text);
  }

  const specifiers: string[] = [];
  try {
    const scriptKind =
      ext === ".tsx"
        ? ts.ScriptKind.TSX
        : ext === ".jsx"
          ? ts.ScriptKind.JSX
          : ext === ".js" || ext === ".mjs" || ext === ".cjs"
            ? ts.ScriptKind.JS
            : ts.ScriptKind.TS;

    const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, false, scriptKind);

    function visit(node: ts.Node) {
      // 1. Static import: import ... from "pkg";
      if (ts.isImportDeclaration(node)) {
        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          specifiers.push(node.moduleSpecifier.text);
        }
      }
      // 2. Export re-export: export ... from "pkg";
      else if (ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          specifiers.push(node.moduleSpecifier.text);
        }
      }
      // 3. Dynamic import or require: import("pkg") or require("pkg")
      else if (ts.isCallExpression(node)) {
        const expr = node.expression;
        if (
          (expr.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(expr) && expr.text === "require")) &&
          node.arguments.length > 0
        ) {
          const arg = node.arguments[0]!;
          if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
            specifiers.push(arg.text);
          }
        }
      }
      // 4. Import equals: import x = require("pkg");
      else if (ts.isImportEqualsDeclaration(node)) {
        if (
          ts.isExternalModuleReference(node.moduleReference) &&
          node.moduleReference.expression &&
          ts.isStringLiteral(node.moduleReference.expression)
        ) {
          specifiers.push(node.moduleReference.expression.text);
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return specifiers;
  } catch {
    return extractSpecifiersRegex(text);
  }
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

    for (const specifier of extractSpecifiers(text, file)) {
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