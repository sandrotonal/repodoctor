import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import type { Diagnostic } from "./types.js";

export interface BaselineEntry {
  id: string;
  fingerprint: string;
  file?: string;
  line?: number;
  title?: string;
}

export interface BaselineData {
  version: string;
  generatedAt: string;
  findings: BaselineEntry[];
}

export function generateFingerprint(diagnostic: Diagnostic): string {
  const normFile = diagnostic.location?.file ? diagnostic.location.file.replace(/\\/g, "/") : "";
  const line = diagnostic.location?.line ?? "";
  const rawId = diagnostic.id;
  const title = diagnostic.title;

  const content = `${rawId}::${normFile}::${line}::${title}`;
  return createHash("sha256").update(content, "utf8").digest("hex").slice(0, 32);
}

export async function loadBaseline(filePath: string): Promise<BaselineData | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as BaselineData;
    if (parsed && Array.isArray(parsed.findings)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveBaseline(filePath: string, diagnostics: Diagnostic[]): Promise<void> {
  // Only save failing/actionable diagnostics in baseline (skip pure success/info)
  const actionable = diagnostics.filter((d) => d.severity === "critical" || d.severity === "warning");

  const findings: BaselineEntry[] = actionable.map((d) => ({
    id: d.id,
    fingerprint: d.fingerprint ?? generateFingerprint(d),
    file: d.location?.file,
    line: d.location?.line,
    title: d.title,
  }));

  const data: BaselineData = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    findings,
  };

  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function filterBaselineDiagnostics(
  diagnostics: Diagnostic[],
  baseline: BaselineData | null,
): { newFindings: Diagnostic[]; baselineMatchedCount: number } {
  if (!baseline || baseline.findings.length === 0) {
    return { newFindings: diagnostics, baselineMatchedCount: 0 };
  }

  const knownFingerprints = new Set(baseline.findings.map((f) => f.fingerprint));
  const newFindings: Diagnostic[] = [];
  let baselineMatchedCount = 0;

  for (const diagnostic of diagnostics) {
    // Pure successes are never suppressed
    if (diagnostic.severity === "success") {
      newFindings.push(diagnostic);
      continue;
    }

    const fp = diagnostic.fingerprint ?? generateFingerprint(diagnostic);
    if (knownFingerprints.has(fp)) {
      baselineMatchedCount += 1;
      // Mark suppressed by baseline
      diagnostic.suppressed = true;
      diagnostic.fingerprint = fp;
    } else {
      diagnostic.fingerprint = fp;
      newFindings.push(diagnostic);
    }
  }

  return { newFindings, baselineMatchedCount };
}
