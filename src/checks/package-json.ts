import type { Diagnostic, PackageJsonData, PackageManagerDetection } from "../core/types.js";

export function checkPackageJson(
  data: PackageJsonData | null,
  parseError: string | null,
  packageManager: PackageManagerDetection,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (data === null) {
    if (parseError !== null) {
      diagnostics.push({
        id: "package-json.invalid",
        severity: "critical",
        title: "Invalid package.json",
        message: parseError,
        recommendation: "Fix the JSON syntax before installing dependencies.",
      });
    }
    return diagnostics;
  }

  diagnostics.push({ id: "package-json.valid", severity: "success", title: "package.json is valid" });

  const scriptNames = Object.keys(data.scripts ?? {});
  if (scriptNames.length > 0) {
    diagnostics.push({
      id: "package-json.scripts",
      severity: "info",
      title: "Scripts available",
      message: scriptNames.join(", "),
    });
  }

  const dependencyCount = Object.keys(data.dependencies ?? {}).length;
  const devDependencyCount = Object.keys(data.devDependencies ?? {}).length;
  if (dependencyCount > 0 || devDependencyCount > 0) {
    diagnostics.push({
      id: "package-json.dependencies",
      severity: "info",
      title: "Dependencies declared",
      message: `${dependencyCount} dependencies, ${devDependencyCount} devDependencies`,
    });
  }

  const nodeRange = data.engines?.node;
  if (typeof nodeRange === "string" && nodeRange.length > 0) {
    diagnostics.push({
      id: "package-json.engines",
      severity: "info",
      title: "Node.js engines declared",
      message: `node ${nodeRange}`,
    });
  }

  const declaredManager = typeof data.packageManager === "string" ? data.packageManager.split("@")[0] : null;
  if (declaredManager && packageManager.manager && declaredManager !== packageManager.manager) {
    diagnostics.push({
      id: "package-manager.mismatch",
      severity: "warning",
      title: "packageManager field conflicts with lock file",
      message: `package.json declares "${declaredManager}", but the lock file indicates ${packageManager.manager}.`,
      recommendation: "Use the package manager declared in package.json and remove conflicting lock files.",
    });
  }

  return diagnostics;
}