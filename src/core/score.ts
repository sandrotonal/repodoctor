import type { Diagnostic, HealthGrade, HealthScore } from "./types.js";

function calculateGrade(score: number): HealthGrade {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 50) return "fair";
  if (score >= 25) return "poor";
  return "critical";
}

function isSecurityDiagnostic(d: Diagnostic): boolean {
  if (d.category === "security") return true;
  if (d.id.startsWith("security") || d.id.startsWith("secret")) return true;
  return false;
}

export function computeHealthScore(diagnostics: Diagnostic[]): HealthScore {
  let critical = 0;
  let warning = 0;

  let secCritical = 0;
  let secWarning = 0;

  let relCritical = 0;
  let relWarning = 0;

  for (const diagnostic of diagnostics) {
    if (diagnostic.suppressed) {
      continue;
    }

    const isSec = isSecurityDiagnostic(diagnostic);

    switch (diagnostic.severity) {
      case "critical":
        critical += 1;
        if (isSec) secCritical += 1;
        else relCritical += 1;
        break;
      case "warning":
        warning += 1;
        if (isSec) secWarning += 1;
        else relWarning += 1;
        break;
      case "info":
      case "success":
        break;
    }
  }

  const criticalDeductions = critical * 30;
  const warningDeductions = warning * 8;
  const overallScore = Math.max(0, Math.min(100, 100 - criticalDeductions - warningDeductions));
  const grade = calculateGrade(overallScore);

  const secCritDeductions = secCritical * 35;
  const secWarnDeductions = secWarning * 10;
  const securityScore = Math.max(0, Math.min(100, 100 - secCritDeductions - secWarnDeductions));
  const securityGrade = calculateGrade(securityScore);

  const relCritDeductions = relCritical * 25;
  const relWarnDeductions = relWarning * 8;
  const reliabilityScore = Math.max(0, Math.min(100, 100 - relCritDeductions - relWarnDeductions));
  const reliabilityGrade = calculateGrade(reliabilityScore);

  return {
    score: overallScore,
    grade,
    overallScore,
    securityScore,
    securityGrade,
    reliabilityScore,
    reliabilityGrade,
    breakdown: {
      criticalDeductions,
      warningDeductions,
      baseScore: 100,
    },
    securityBreakdown: {
      criticalDeductions: secCritDeductions,
      warningDeductions: secWarnDeductions,
      baseScore: 100,
    },
    reliabilityBreakdown: {
      criticalDeductions: relCritDeductions,
      warningDeductions: relWarnDeductions,
      baseScore: 100,
    },
  };
}