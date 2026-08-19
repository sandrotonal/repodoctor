import { builtinModules } from "node:module";
import type { Diagnostic, PackageJsonData } from "../core/types.js";
import type { ImportScan } from "../detectors/imports.js";

const BUILTINS = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nameMentionedInText(name: string, text: string): boolean {
  const escaped = escapeRegExp(name);
  return new RegExp(`(?:^|[\\s"'=:)(,\\/])${escaped}(?=$|[\\s"'=:)(,\\/])`).test(text);
}

const BIN_ALIASES: Readonly<Record<string, string[]>> = {
  typescript: ["tsc", "tsserver"],
  vue: ["vue-tsc"],
  "next": ["next"],
};

function scriptMentionCandidates(name: string): string[] {
  const candidates = [name];
  const unscoped = name.includes("/") ? name.split("/").pop()! : name;
  if (unscoped !== name) {
    candidates.push(unscoped);
  }
  for (const alias of BIN_ALIASES[name] ?? []) {
    candidates.push(alias);
  }
  return candidates;
}

export interface DependencyUsageContext {
  data: PackageJsonData | null;
  imports: ImportScan;
}

export function checkDependencyUsage(ctx: DependencyUsageContext): Diagnostic[] {
  const { data, imports } = ctx;
  const diagnostics: Diagnostic[] = [];

  if (data === null) {
    return diagnostics;
  }

  const dependencies = data.dependencies ?? {};
  const devDependencies = data.devDependencies ?? {};
  const optionalDependencies = data.optionalDependencies ?? {};
  const peerDependencies = data.peerDependencies ?? {};
  const scripts = Object.values(data.scripts ?? {});

  const installable: Record<string, string> = { ...dependencies, ...devDependencies, ...optionalDependencies };
  const known: Record<string, string> = { ...installable, ...peerDependencies };
  const installedNames = Object.keys(installable);

  const mentionedInScripts = new Set<string>();
  for (const script of scripts) {
    for (const name of installedNames) {
      if (scriptMentionCandidates(name).some((candidate) => nameMentionedInText(candidate, script))) {
        mentionedInScripts.add(name);
      }
    }
  }

  const mentioned = new Set<string>([...imports.packagesUsed, ...mentionedInScripts]);

  const unused = installedNames.filter((name) => !name.startsWith("@types/") && !mentioned.has(name));
  if (unused.length > 0) {
    diagnostics.push({
      id: "dependencies.unused",
      severity: "warning",
      title: "Unused dependencies detected",
      message: unused.join(", "),
      recommendation: "Remove unused packages or verify they are referenced from non-source files.",
    });
  }

  const missing = [...imports.packagesImported].filter((name) => !known[name] && !BUILTINS.has(name));
  if (missing.length > 0) {
    diagnostics.push({
      id: "dependencies.imported-not-declared",
      severity: "warning",
      title: "Imported packages not declared in package.json",
      message: missing.join(", "),
      recommendation: "Add these packages to dependencies in package.json.",
    });
  }

  return diagnostics;
}