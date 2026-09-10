/**
 * Deterministic exit code contracts for RepoDoctor CLI.
 * Guarantees consistent and predictable behavior in CI/CD pipelines.
 */
export const EXIT_CODES = {
  /** 0: Scan completed and no configured failure threshold was exceeded */
  SUCCESS: 0,
  /** 1: Security or reliability diagnostics exceeded the failure threshold (e.g. --ci or --fail-on) */
  FINDINGS_THRESHOLD: 1,
  /** 2: Invalid CLI arguments, missing parameters, or usage errors */
  CLI_USAGE_ERROR: 2,
  /** 3: Scan could not be completed due to missing target directory or critical I/O failure */
  SCAN_ABORTED_IO: 3,
  /** 4: Report export failed (e.g. permission denied writing HTML, SARIF, or Markdown file) */
  EXPORT_FAILED: 4,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

export type FailOnThreshold = "critical" | "warning" | "info";

export function shouldFailScan(
  diagnostics: Array<{ severity: "critical" | "warning" | "info" | "success" }>,
  options: { ci?: boolean; strict?: boolean; failOn?: FailOnThreshold },
): boolean {
  const activeFindings = diagnostics.filter((d) => d.severity !== "success");
  if (activeFindings.length === 0) return false;

  const rawThreshold = options.failOn?.toLowerCase() as FailOnThreshold | undefined;
  const threshold: FailOnThreshold | null =
    rawThreshold ?? (options.strict || options.ci ? "warning" : null);

  if (!threshold) {
    // Normal mode: only fail on critical security/reliability issues
    return activeFindings.some((d) => d.severity === "critical");
  }

  if (threshold === "info") {
    return activeFindings.some(
      (d) => d.severity === "critical" || d.severity === "warning" || d.severity === "info",
    );
  }

  if (threshold === "warning") {
    return activeFindings.some(
      (d) => d.severity === "critical" || d.severity === "warning",
    );
  }

  // threshold === "critical"
  return activeFindings.some((d) => d.severity === "critical");
}
