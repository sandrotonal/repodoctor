import type { Diagnostic } from "../core/types.js";
import type { WorkspaceScanResult } from "../detectors/workspaces.js";

export function checkWorkspaces(scan: WorkspaceScanResult): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (!scan.isMonorepo) {
    return diagnostics;
  }

  diagnostics.push({
    id: "monorepo.detected",
    severity: "info",
    title: `Monorepo detected (${scan.tool})`,
    message: `Found ${scan.packages.length} workspace packages.`,
  });

  for (const drift of scan.versionDrifts) {
    const details = drift.versions.map((v) => `${v.workspaceName}: ${v.version}`).join(", ");
    diagnostics.push({
      id: `monorepo.version-drift:${drift.packageName}`,
      severity: "warning",
      title: `Dependency version drift detected for "${drift.packageName}"`,
      message: `Mismatched versions across packages: ${details}`,
      recommendation: `Align '${drift.packageName}' to a unified version across all workspace packages or hoist it to the root.`,
    });
  }

  return diagnostics;
}
