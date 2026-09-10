import type { Diagnostic } from "../core/types.js";
import type { SecurityScan } from "../detectors/secrets.js";

export function checkSecurity(scan: SecurityScan): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Check secrets
  for (const finding of scan.secretFindings) {
    if (finding.suppressed) {
      diagnostics.push({
        id: `${finding.ruleId}:${finding.file}:${finding.line}`,
        severity: "info",
        title: `Suppressed example credential: ${finding.ruleName}`,
        message: `Found in ${finding.file}:${finding.line} (${finding.maskedMatch}) - ${finding.reason ?? "Known dummy/example credential"}`,
        recommendation: "Placeholder or documentation key ignored. Replace with real credentials in private environment.",
        category: "security",
        confidence: "suppressed",
        suppressed: true,
        location: {
          file: finding.file,
          line: finding.line,
          column: finding.column,
        },
      });
      continue;
    }

    diagnostics.push({
      id: `${finding.ruleId}:${finding.file}:${finding.line}`,
      severity: finding.severity,
      title: `Potential ${finding.ruleName} leak detected`,
      message: `Found in ${finding.file}:${finding.line} (${finding.maskedMatch})`,
      recommendation: "Move secrets to .env file and ensure .env is gitignored. Revoke leaked keys immediately.",
      category: "security",
      confidence: finding.confidence,
      suppressed: false,
      location: {
        file: finding.file,
        line: finding.line,
        column: finding.column,
      },
    });
  }

  // Check dangerous scripts
  for (const script of scan.dangerousScripts) {
    diagnostics.push({
      id: `security.dangerous-script:${script.scriptName}`,
      severity: script.severity,
      title: `Suspicious script command in "${script.scriptName}"`,
      message: `${script.reason}: "${script.command}"`,
      recommendation: "Review this script to ensure it does not execute untrusted commands or delete critical paths.",
      category: "security",
      confidence: "high",
    });
  }

  const activeSecrets = scan.secretFindings.filter((f) => !f.suppressed);
  if (activeSecrets.length === 0 && scan.dangerousScripts.length === 0) {
    diagnostics.push({
      id: "security.clean",
      severity: "success",
      title: "No hardcoded secrets or suspicious scripts detected",
      category: "security",
    });
  }

  return diagnostics;
}
