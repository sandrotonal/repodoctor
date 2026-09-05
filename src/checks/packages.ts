import type { Diagnostic } from "../core/types.js";
import type { PackageSupplyChainResult } from "../detectors/packages.js";

export function checkPackages(result: PackageSupplyChainResult): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // 1. Typosquat checks (Critical security)
  for (const typo of result.typosquats) {
    diagnostics.push({
      id: `packages.typosquat:${typo.name}`,
      severity: "critical",
      title: `Potential typosquatting package detected: "${typo.name}"`,
      message: `Package name closely mimics legitimate package "${typo.targetPackage}".`,
      recommendation: `Uninstall "${typo.name}" and install "${typo.targetPackage}" instead.`,
    });
  }

  // 2. Deprecated packages (Warning)
  for (const dep of result.deprecated) {
    diagnostics.push({
      id: `packages.deprecated:${dep.name}`,
      severity: "warning",
      title: `Deprecated package detected: "${dep.name}"`,
      message: `${dep.reason}${dep.replacement ? ` Recommended replacement: ${dep.replacement}.` : ""}`,
      recommendation: dep.replacement ? `Migrate from '${dep.name}' to '${dep.replacement}'.` : `Remove '${dep.name}'.`,
    });
  }

  // 3. Copyleft / restrictive license in project
  if (result.copyleftLicense) {
    diagnostics.push({
      id: "packages.license-copyleft",
      severity: "info",
      title: `Copyleft license declared: ${result.copyleftLicense}`,
      message: "Strong copyleft licenses may require derivative works to be open-sourced.",
      recommendation: "Ensure this license aligns with your project's distribution requirements.",
    });
  }

  // 4. Missing license in published or named package
  if (result.missingLicense) {
    diagnostics.push({
      id: "packages.license-missing",
      severity: "info",
      title: "No license declared in package.json",
      message: "Adding an explicit license (e.g. MIT, Apache-2.0) clarifies usage terms for consumers.",
      recommendation: "Add a 'license' field to package.json.",
    });
  }

  return diagnostics;
}
