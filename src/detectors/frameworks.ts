import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { PackageJsonData } from "../core/types.js";

export type FrameworkType = "nextjs" | "vite" | "nuxt" | "remix" | "astro" | "none";

export interface FrameworkScanIssue {
  id: string;
  type: "client-secret-leak" | "env-prefix-mismatch" | "missing-config";
  file: string;
  line?: number;
  message: string;
  recommendation: string;
  severity: "critical" | "warning" | "info";
}

export interface FrameworkScanResult {
  frameworks: FrameworkType[];
  hasTailwind: boolean;
  issues: FrameworkScanIssue[];
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
]);

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".vue", ".svelte"]);

async function walkFiles(dir: string, maxFiles = 3000): Promise<string[]> {
  const files: string[] = [];
  let count = 0;

  async function visit(current: string): Promise<void> {
    if (count >= maxFiles) return;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (count >= maxFiles) return;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          await visit(full);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SOURCE_EXTENSIONS.has(ext)) {
          files.push(full);
          count += 1;
        }
      }
    }
  }

  await visit(dir);
  return files;
}

export async function detectFrameworks(
  root: string,
  pkg: PackageJsonData | null,
): Promise<FrameworkScanResult> {
  const frameworks: FrameworkType[] = [];
  const issues: FrameworkScanIssue[] = [];

  const allDeps: Record<string, string> = {
    ...(pkg?.dependencies ?? {}),
    ...(pkg?.devDependencies ?? {}),
  };

  if ("next" in allDeps) frameworks.push("nextjs");
  if ("vite" in allDeps) frameworks.push("vite");
  if ("nuxt" in allDeps) frameworks.push("nuxt");
  if ("@remix-run/react" in allDeps || "@remix-run/node" in allDeps) frameworks.push("remix");
  if ("astro" in allDeps) frameworks.push("astro");

  const hasTailwind = "tailwindcss" in allDeps;

  // 1. Check Tailwind configs if installed
  if (hasTailwind) {
    let rootEntries: string[] = [];
    try {
      rootEntries = await readdir(root);
    } catch {
      rootEntries = [];
    }
    const hasTailwindConfig = rootEntries.some((f) => /^tailwind\.config\.(?:js|cjs|mjs|ts)$/i.test(f));
    const hasPostcssConfig = rootEntries.some((f) => /^postcss\.config\.(?:js|cjs|mjs|ts|json)$/i.test(f));

    if (!hasTailwindConfig) {
      issues.push({
        id: "framework.tailwind.missing-config",
        type: "missing-config",
        file: "package.json",
        message: "tailwindcss is declared in dependencies but no tailwind.config.* file was found.",
        recommendation: "Run 'npx tailwindcss init' to generate a Tailwind configuration.",
        severity: "warning",
      });
    }

    if (!hasPostcssConfig && !frameworks.includes("vite")) {
      issues.push({
        id: "framework.tailwind.missing-postcss",
        type: "missing-config",
        file: "package.json",
        message: "tailwindcss is declared but no postcss.config.* file was found.",
        recommendation: "Generate a postcss.config.js with tailwindcss and autoprefixer plugins.",
        severity: "info",
      });
    }
  }

  // 2. Scan source files for Next.js & Vite specific issues
  if (frameworks.includes("nextjs") || frameworks.includes("vite")) {
    const files = await walkFiles(root);

    for (const file of files) {
      let text = "";
      try {
        text = await readFile(file, "utf8");
      } catch {
        continue;
      }

      const relPath = path.relative(root, file).replace(/\\/g, "/");
      const isClientComponent = /^\s*["']use client["']/m.test(text);

      // Next.js: "use client" importing server-only or backend DB clients
      if (frameworks.includes("nextjs") && isClientComponent) {
        if (/import\s+["']server-only["']/m.test(text)) {
          issues.push({
            id: `framework.nextjs.server-only-in-client:${relPath}`,
            type: "client-secret-leak",
            file: relPath,
            message: "Client Component ('use client') imports 'server-only', which will cause build failures.",
            recommendation: "Remove 'server-only' from client components or move server logic to an API route / server action.",
            severity: "critical",
          });
        }

        if (/from\s+["'](?:@prisma\/client|pg|mysql2|mongoose|mongodb)["']/m.test(text)) {
          issues.push({
            id: `framework.nextjs.db-client-in-client:${relPath}`,
            type: "client-secret-leak",
            file: relPath,
            message: "Database client imported inside a Client Component ('use client').",
            recommendation: "Database operations must only be executed on the server or inside Server Actions.",
            severity: "critical",
          });
        }
      }

      // Env Prefix mismatches
      if (frameworks.includes("vite")) {
        // Vite using NEXT_PUBLIC_ or REACT_APP_
        const match = text.match(/process\.env\.(NEXT_PUBLIC_[A-Za-z0-9_]+|REACT_APP_[A-Za-z0-9_]+)/);
        if (match) {
          issues.push({
            id: `framework.env.prefix-mismatch:${relPath}`,
            type: "env-prefix-mismatch",
            file: relPath,
            message: `Vite project uses '${match[0]}'. Vite only exposes variables prefixed with 'VITE_' via 'import.meta.env'.`,
            recommendation: `Rename to 'import.meta.env.VITE_${match[1]?.replace(/^(?:NEXT_PUBLIC_|REACT_APP_)/, "")}'.`,
            severity: "warning",
          });
        }
      }

      if (frameworks.includes("nextjs")) {
        // Next.js using import.meta.env.VITE_
        const match = text.match(/import\.meta\.env\.(VITE_[A-Za-z0-9_]+)/);
        if (match) {
          issues.push({
            id: `framework.env.prefix-mismatch:${relPath}`,
            type: "env-prefix-mismatch",
            file: relPath,
            message: `Next.js project uses '${match[0]}'. Next.js exposes client variables prefixed with 'NEXT_PUBLIC_' via 'process.env'.`,
            recommendation: `Rename to 'process.env.NEXT_PUBLIC_${match[1]?.replace(/^VITE_/, "")}'.`,
            severity: "warning",
          });
        }
      }
    }
  }

  return {
    frameworks,
    hasTailwind,
    issues,
  };
}
