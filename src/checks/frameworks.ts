import type { Diagnostic } from "../core/types.js";
import type { FrameworkScanResult } from "../detectors/frameworks.js";

export function checkFrameworks(result: FrameworkScanResult): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (result.frameworks.length > 0) {
    const formatted = result.frameworks
      .map((f) => (f === "nextjs" ? "Next.js" : f.charAt(0).toUpperCase() + f.slice(1)))
      .join(", ");
    diagnostics.push({
      id: "framework.detected",
      severity: "info",
      title: `Framework detected: ${formatted}`,
    });
  }

  for (const issue of result.issues) {
    diagnostics.push({
      id: issue.id,
      severity: issue.severity,
      title: issue.message,
      message: `File: ${issue.file}`,
      recommendation: issue.recommendation,
    });
  }

  return diagnostics;
}
