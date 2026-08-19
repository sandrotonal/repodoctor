import type { Diagnostic, PackageJsonData, PackageManagerDetection } from "../core/types.js";
import type { NpmLockResult } from "../detectors/lock-file.js";

export interface DependencyCheckContext {
  data: PackageJsonData | null;
  nodeModulesInstalled: boolean;
  packageManager: PackageManagerDetection;
  npmLock: NpmLockResult | null;
}

export function checkDependencies(ctx: DependencyCheckContext): Diagnostic[] {
  const { data, nodeModulesInstalled, packageManager, npmLock } = ctx;
  const diagnostics: Diagnostic[] = [];

  if (data === null) {
    return diagnostics;
  }

  const declared: Record<string, string> = {
    ...(data.dependencies ?? {}),
    ...(data.devDependencies ?? {}),
  };
  const declaredNames = Object.keys(declared);
  if (declaredNames.length === 0) {
    return diagnostics;
  }

  if (!nodeModulesInstalled) {
    diagnostics.push({
      id: "dependencies.node-modules-missing",
      severity: "warning",
      title: "node_modules is not installed",
      message: `${declaredNames.length} dependencies declared but node_modules is missing.`,
      recommendation: "Run your package manager's install command before starting development.",
    });
  }

  if (packageManager.lockFiles.length === 0) {
    diagnostics.push({
      id: "dependencies.lock-file-missing",
      severity: "warning",
      title: "No lock file found",
      message: "Dependencies are declared but no lock file is committed.",
      recommendation: "Generate and commit a lock file so builds are reproducible.",
    });
  }

  if (packageManager.manager === "npm" && npmLock !== null && npmLock.exists) {
    if (npmLock.content === null) {
      diagnostics.push({
        id: "dependencies.lock-invalid",
        severity: "warning",
        title: "Invalid package-lock.json",
        message: npmLock.parseError ?? "The lock file could not be parsed.",
        recommendation: "Delete package-lock.json and regenerate it with npm install.",
      });
    } else {
      const { installedNames, rootDependencies } = npmLock.content;
      const missing = declaredNames.filter((name) => !installedNames.has(name));
      const specMismatch = declaredNames.filter(
        (name) =>
          !missing.includes(name) &&
          rootDependencies[name] !== undefined &&
          rootDependencies[name] !== declared[name],
      );
      if (missing.length > 0 || specMismatch.length > 0) {
        const details = [
          ...missing.map((name) => `${name} (missing)`),
          ...specMismatch.map((name) => `${name} (spec changed)`),
        ];
        diagnostics.push({
          id: "dependencies.lock-out-of-sync",
          severity: "warning",
          title: "Lock file out of sync with package.json",
          message: details.join(", "),
          recommendation: "Run npm install to regenerate the lock file.",
        });
      }
    }
  }

  return diagnostics;
}