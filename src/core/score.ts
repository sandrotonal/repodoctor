import type { Diagnostic, HealthScore } from "./types.js";

export function computeHealthScore(diagnostics: Diagnostic[]): HealthScore {
  let critical = 0;
  let warning = 0;
  let info = 0;
  for (const diagnostic of diagnostics) {
    switch (diagnostic.severity) {
      case "critical":
        critical += 1;
        break;
      case "warning":
        warning += 1;
        break;
      case "info":
        info += 1;
        break;
      case "success":
        break;
    }
  }

  const score = Math.max(0, Math.min(100, 100 - critical * 30 - warning * 8 - info * 1));

  let grade: HealthScore["grade"];
  if (score >= 90) grade = "excellent";
  else if (score >= 75) grade = "good";
  else if (score >= 50) grade = "fair";
  else if (score >= 25) grade = "poor";
  else grade = "critical";

  return { score, grade };
}