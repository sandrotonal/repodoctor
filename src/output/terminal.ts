import chalk from "chalk";
import type { Diagnostic, HealthGrade, ScanResult } from "../core/types.js";

export function renderScan(result: ScanResult): void {
  console.log(chalk.cyan("RepoDoctor"));
  console.log("");
  console.log("Scanning project...");
  console.log("");

  for (const diagnostic of result.diagnostics) {
    console.log(renderDiagnostic(diagnostic));
    if (diagnostic.message) {
      console.log(chalk.dim(`  ${diagnostic.message}`));
    }
    if (diagnostic.recommendation) {
      console.log(chalk.dim(`  -> ${diagnostic.recommendation}`));
    }
  }

  console.log("");
  console.log(`Health score: ${renderHealth(result.health.score, result.health.grade)}`);
  console.log("Scan completed.");
}

function renderDiagnostic(diagnostic: Diagnostic): string {
  switch (diagnostic.severity) {
    case "success":
      return `${chalk.green("[OK]")} ${diagnostic.title}`;
    case "warning":
      return `${chalk.yellow("[WARN]")} ${diagnostic.title}`;
    case "info":
      return `${chalk.blue("[INFO]")} ${diagnostic.title}`;
    case "critical":
      return `${chalk.red("[FAIL]")} ${diagnostic.title}`;
  }
}

function healthColor(grade: HealthGrade): (text: string) => string {
  switch (grade) {
    case "excellent":
    case "good":
      return chalk.green;
    case "fair":
      return chalk.yellow;
    case "poor":
      return chalk.magenta;
    case "critical":
      return chalk.red;
  }
}

function renderHealth(score: number, grade: HealthGrade): string {
  return healthColor(grade)(`${score}/100 (${grade.toUpperCase()})`);
}