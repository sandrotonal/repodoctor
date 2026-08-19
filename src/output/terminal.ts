import chalk from "chalk";
import type { Diagnostic, ScanResult } from "../core/types.js";

export function renderScan(result: ScanResult): void {
  console.log(chalk.cyan("🩺 RepoDoctor"));
  console.log("");
  console.log("Scanning project...");
  console.log("");

  for (const diagnostic of result.diagnostics) {
    console.log(renderDiagnostic(diagnostic));
  }

  console.log("");
  console.log("Scan completed.");
}

function renderDiagnostic(diagnostic: Diagnostic): string {
  switch (diagnostic.severity) {
    case "success":
      return `${chalk.green("✓")} ${diagnostic.title}`;
    case "warning":
      return `${chalk.yellow("⚠")} ${diagnostic.title}`;
    case "info":
      return `${chalk.blue("ℹ")} ${diagnostic.title}`;
    case "critical":
      return `${chalk.red("✗")} ${diagnostic.title}`;
  }
}