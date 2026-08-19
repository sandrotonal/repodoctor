import semver from "semver";
import type { Diagnostic, PackageJsonData } from "../core/types.js";

export function checkNodeVersion(current: string, data: PackageJsonData | null): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  diagnostics.push({ id: "node.runtime", severity: "info", title: `Node.js ${current} detected` });

  const nodeRange = data?.engines?.node;
  if (typeof nodeRange !== "string" || nodeRange.length === 0) {
    return diagnostics;
  }

  if (!semver.validRange(nodeRange)) {
    diagnostics.push({
      id: "node-version.invalid-range",
      severity: "warning",
      title: "Invalid Node.js version range",
      message: `engines.node: "${nodeRange}" is not a valid semver range.`,
      recommendation: "Fix the engines.node value in package.json.",
    });
    return diagnostics;
  }

  const currentVersion = semver.valid(current);
  if (currentVersion !== null && semver.satisfies(currentVersion, nodeRange)) {
    diagnostics.push({
      id: "node-version.compatible",
      severity: "success",
      title: "Node.js version compatible",
      message: `${current} satisfies node ${nodeRange}.`,
    });
  } else {
    diagnostics.push({
      id: "node-version.mismatch",
      severity: "critical",
      title: "Node.js version mismatch",
      message: `Required: node ${nodeRange}. Current: ${current}.`,
      recommendation: "Use a compatible Node.js version (for example via nvm or fnm).",
    });
  }

  return diagnostics;
}