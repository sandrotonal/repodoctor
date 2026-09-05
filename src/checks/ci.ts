import type { Diagnostic } from "../core/types.js";
import type { CiScanResult } from "../detectors/ci.js";

export function checkCi(result: CiScanResult): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (!result.hasCi) {
    diagnostics.push({
      id: "ci.not-configured",
      severity: "info",
      title: "No GitHub Actions CI/CD workflows detected",
      message: "Automated CI ensures every pull request is checked for regressions and secret leaks.",
      recommendation: "Run 'npx @gucluyumhe/repodoctor init-ci' to set up GitHub Actions in one command.",
    });
    return diagnostics;
  }

  diagnostics.push({
    id: "ci.detected",
    severity: "success",
    title: "GitHub Actions workflows detected",
    message: `${result.workflowFiles.length} workflow file(s) found.`,
  });

  if (!result.hasRepoDoctorCi) {
    diagnostics.push({
      id: "ci.repodoctor-missing",
      severity: "info",
      title: "RepoDoctor is not running in CI pipeline",
      message: "Running RepoDoctor on pull requests automatically catches secret leaks and broken dependencies.",
      recommendation: "Run 'npx @gucluyumhe/repodoctor init-ci' to add the official workflow.",
    });
  }

  for (const issue of result.issues) {
    diagnostics.push({
      id: `ci.issue:${issue.file}:${issue.line}`,
      severity: issue.severity,
      title: issue.message,
      message: `File: ${issue.file}:${issue.line}`,
      recommendation: issue.recommendation,
    });
  }

  return diagnostics;
}
