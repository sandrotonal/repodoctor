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
      category: "security",
      confidence: "high",
    });
  }

  // 2. Dangerous install lifecycle scripts in package.json (Critical security)
  for (const risk of result.installScriptRisks) {
    diagnostics.push({
      id: `packages.install-script:${risk.scriptName}`,
      severity: "critical",
      title: `Suspicious install script command in "${risk.scriptName}"`,
      message: `${risk.reason}: "${risk.command}".`,
      recommendation: "Review install script before allowing execution in CI or local environment. Avoid piping remote URLs into shell.",
      category: "security",
      confidence: "high",
    });
  }

  // 3. Insecure dependency protocols or wildcard versions (Warning / Critical)
  for (const dep of result.insecureDependencies) {
    const isCritical = dep.type === "http-url";
    diagnostics.push({
      id: `packages.insecure-dependency:${dep.name}`,
      severity: isCritical ? "critical" : "warning",
      title: `Insecure dependency specification: "${dep.name}" (${dep.version})`,
      message: dep.reason,
      recommendation:
        dep.type === "http-url"
          ? "Switch to secure HTTPS or standard npm registry package version."
          : dep.type === "unpinned-git"
            ? "Pin git dependency to an immutable commit SHA (e.g. #<commit-hash>)."
            : "Declare an explicit semantic version range instead of wildcard or 'latest'.",
      category: "security",
      confidence: "high",
    });
  }

  // 4. Deprecated packages (Warning)
  for (const dep of result.deprecated) {
    diagnostics.push({
      id: `packages.deprecated:${dep.name}`,
      severity: "warning",
      title: `Deprecated package detected: "${dep.name}"`,
      message: `${dep.reason}${dep.replacement ? ` Recommended replacement: ${dep.replacement}.` : ""}`,
      recommendation: dep.replacement ? `Migrate from '${dep.name}' to '${dep.replacement}'.` : `Remove '${dep.name}'.`,
      category: "reliability",
    });
  }

  // 5. Copyleft / restrictive license in project
  if (result.copyleftLicense) {
    diagnostics.push({
      id: "packages.license-copyleft",
      severity: "info",
      title: `Copyleft license declared: ${result.copyleftLicense}`,
      message: "Strong copyleft licenses may require derivative works to be open-sourced.",
      recommendation: "Ensure this license aligns with your project's distribution requirements.",
      category: "reliability",
    });
  }

  // 6. Missing license in published or named package
  if (result.missingLicense) {
    diagnostics.push({
      id: "packages.license-missing",
      severity: "info",
      title: "No license declared in package.json",
      message: "Adding an explicit license (e.g. MIT, Apache-2.0) clarifies usage terms for consumers.",
      recommendation: "Add a 'license' field to package.json.",
      category: "reliability",
    });
  }

  return diagnostics;
}
