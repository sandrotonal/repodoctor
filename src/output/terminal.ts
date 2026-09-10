import chalk from "chalk";
import type { Diagnostic, HealthGrade, ScanResult, Severity } from "../core/types.js";
import { clamp, gradient, padAnsi, segmentBar, visibleLength, wordWrap } from "./theme.js";
import { renderLogo } from "./logo.js";

export type ScanStyle = "plain" | "panel";

export function renderScan(result: ScanResult, style: ScanStyle = "plain"): void {
  process.stdout.write(`${formatScan(result, style)}\n`);
}

export function formatScan(result: ScanResult, style: ScanStyle): string {
  return style === "panel" ? formatPanelScan(result) : formatPlainScan(result);
}

/* ---------------------------------- plain --------------------------------- */

function formatPlainScan(result: ScanResult): string {
  const lines: string[] = [chalk.cyan("RepoDoctor"), "", "Scanning project...", ""];

  for (const diagnostic of result.diagnostics) {
    lines.push(renderDiagnostic(diagnostic));
    if (diagnostic.message) {
      lines.push(chalk.dim(`  ${diagnostic.message}`));
    }
    if (diagnostic.recommendation) {
      lines.push(chalk.dim(`  -> ${diagnostic.recommendation}`));
    }
  }

  const secScore = result.health.securityScore;
  const relScore = result.health.reliabilityScore;
  const dualSummary =
    secScore !== undefined && relScore !== undefined
      ? ` (Security: ${secScore}/100, Reliability: ${relScore}/100)`
      : "";
  lines.push("", `Health score: ${renderHealth(result.health.score, result.health.grade)}${dualSummary}`);
  if (result.coverage) {
    lines.push(
      chalk.dim(
        `Coverage: ${result.coverage.filesScanned} files scanned (${result.coverage.filesSkipped} skipped) in ${result.coverage.durationMs}ms`,
      ),
    );
  }
  lines.push("Scan completed.");
  return lines.join("\n");
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

/* ---------------------------------- panel --------------------------------- */

const SEVERITY_COLORS: Record<Severity, (text: string) => string> = {
  critical: chalk.red,
  warning: chalk.yellow,
  success: chalk.green,
  info: chalk.blue,
};

const SEVERITY_LABELS: Record<Severity, string> = {
  success: "[OK]",
  warning: "[WARN]",
  info: "[INFO]",
  critical: "[FAIL]",
};

const SEVERITY_ORDER: Record<Severity, number> = { success: 0, info: 1, warning: 2, critical: 3 };

const CATEGORY_ORDER = ["Project", "Security", "Packages", "CI/CD", "Frameworks", "Monorepo", "Dependencies", "TypeScript", "Node.js", "Environment", "Git", "Docker", "Ports"];

function categoryOf(id: string): string {
  if (id.startsWith("secret") || id.startsWith("security")) return "Security";
  if (id.startsWith("packages.")) return "Packages";
  if (id.startsWith("ci.")) return "CI/CD";
  if (id.startsWith("framework")) return "Frameworks";
  if (id.startsWith("monorepo")) return "Monorepo";
  if (id.startsWith("typescript")) return "TypeScript";
  if (id.startsWith("docker")) return "Docker";
  if (id.startsWith("node")) return "Node.js";
  if (id.startsWith("package-") || id.startsWith("dependencies")) return "Dependencies";
  if (id.startsWith("env")) return "Environment";
  if (id.startsWith("git")) return "Git";
  if (id.startsWith("port")) return "Ports";
  return "Project";
}

function groupDiagnostics(diagnostics: Diagnostic[]): Array<[string, Diagnostic[]]> {
  const map = new Map<string, Diagnostic[]>();
  for (const diagnostic of diagnostics) {
    const category = categoryOf(diagnostic.id);
    const group = map.get(category);
    if (group) {
      group.push(diagnostic);
    } else {
      map.set(category, [diagnostic]);
    }
  }
  return CATEGORY_ORDER.filter((category) => map.has(category)).map((category) => [category, map.get(category)!]);
}

function worstSeverity(diagnostics: Diagnostic[]): Severity {
  let worst: Severity = "success";
  for (const diagnostic of diagnostics) {
    if (SEVERITY_ORDER[diagnostic.severity] > SEVERITY_ORDER[worst]) {
      worst = diagnostic.severity;
    }
  }
  return worst;
}

function formatPanelScan(result: ScanResult): string {
  const columns = process.stdout.columns ?? 82;
  const inner = clamp(columns - 4, 46, 100);
  const lines: string[] = [renderHeader(inner)];

  for (const [category, diagnostics] of groupDiagnostics(result.diagnostics)) {
    lines.push(renderCategoryPanel(category, diagnostics, inner));
  }

  lines.push(renderHealthPanel(result, inner), chalk.dim("Scan completed."));
  return lines.join("\n");
}

function renderHeader(inner: number): string {
  const border = chalk.cyan;
  return [
    border(`╔${"═".repeat(inner)}╗`),
    ...renderLogo(inner).map((row) => `║${padAnsi(row, inner)}║`),
    border(`╚${"═".repeat(inner)}╝`),
  ].join("\n");
}

function renderCategoryPanel(category: string, diagnostics: Diagnostic[], inner: number): string {
  const worst = worstSeverity(diagnostics);
  const color = SEVERITY_COLORS[worst];

  const dashes = Math.max(2, inner - 3 - visibleLength(category));

  const body: string[] = [];
  for (const diagnostic of diagnostics) {
    const label = SEVERITY_LABELS[diagnostic.severity];
    const itemColor = SEVERITY_COLORS[diagnostic.severity];
    const head = `${itemColor(label)} ${diagnostic.title}`;

    body.push(...wordWrap(head, inner - 2));

    if (diagnostic.message) {
      body.push(...wordWrap(chalk.dim(diagnostic.message), inner - 2).map((l) => `  ${l}`));
    }
    if (diagnostic.recommendation) {
      body.push(...wordWrap(chalk.dim(`-> ${diagnostic.recommendation}`), inner - 2).map((l) => `  ${l}`));
    }
  }

  return [
    `${color("╭")}${color("─")} ${gradient(category, [0, 196, 255], [255, 106, 255])} ${color("─".repeat(dashes))}${color("╮")}`,
    ...body.map((line) => `${color("│")} ${padAnsi(line, inner - 2)} ${color("│")}`),
    `${color("╰")}${color("─".repeat(inner))}${color("╯")}`,
    "",
  ].join("\n");
}

function renderHealthPanel(result: ScanResult, inner: number): string {
  const gradeColor = healthColor(result.health.grade);
  const barWidth = Math.max(8, inner - 24);
  const bar = segmentBar(result.health.score / 100, barWidth);
  const title = gradeColor(`Health ${result.health.score}/100 ${result.health.grade.toUpperCase()}`);
  const dashes = Math.max(2, inner - 3 - visibleLength(title));

  const counts = { critical: 0, warning: 0, info: 0 };
  for (const diagnostic of result.diagnostics) {
    if (diagnostic.severity in counts) {
      counts[diagnostic.severity as keyof typeof counts] += 1;
    }
  }
  const summary = `${counts.critical} critical ${chalk.dim("·")} ${counts.warning} warning ${chalk.dim("·")} ${counts.info} info`;

  const lines = [
    `${chalk.cyan("╭")}${chalk.cyan("─")} ${title} ${chalk.cyan("─".repeat(dashes))}${chalk.cyan("╮")}`,
    `${chalk.cyan("│")} ${padAnsi(gradeColor(bar), inner - 2)} ${chalk.cyan("│")}`,
    `${chalk.cyan("│")} ${padAnsi(summary, inner - 2)} ${chalk.cyan("│")}`,
  ];

  const secScore = result.health.securityScore;
  const relScore = result.health.reliabilityScore;
  if (secScore !== undefined && relScore !== undefined) {
    const secColor = healthColor(result.health.securityGrade ?? result.health.grade);
    const relColor = healthColor(result.health.reliabilityGrade ?? result.health.grade);
    const dualSummary = `Security: ${secColor(`${secScore}/100`)} ${chalk.dim("·")} Reliability: ${relColor(`${relScore}/100`)}`;
    lines.push(`${chalk.cyan("│")} ${padAnsi(dualSummary, inner - 2)} ${chalk.cyan("│")}`);
  }

  if (result.coverage) {
    const cov = chalk.dim(`Coverage: ${result.coverage.filesScanned} files scanned (${result.coverage.filesSkipped} skipped) in ${result.coverage.durationMs}ms`);
    lines.push(`${chalk.cyan("│")} ${padAnsi(cov, inner - 2)} ${chalk.cyan("│")}`);
  }

  lines.push(`${chalk.cyan("╰")}${chalk.cyan("─".repeat(inner))}${chalk.cyan("╯")}`, "");
  return lines.join("\n");
}

function healthColor(grade?: HealthGrade): (text: string) => string {
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
    default:
      return chalk.green;
  }
}

function renderHealth(score: number, grade: HealthGrade): string {
  return healthColor(grade)(`${score}/100 (${grade.toUpperCase()})`);
}