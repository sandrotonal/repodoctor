import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import type { Diagnostic } from "./types.js";

export interface BaselineEntry {
  id: string;
  ruleId?: string;
  ruleVersion?: string;
  fingerprint: string;
  file?: string;
  line?: number;
  title?: string;
}

export interface BaselineData {
  schemaVersion?: number;
  toolVersion?: string;
  version?: string;
  root?: string;
  createdAt?: string;
  generatedAt?: string;
  findings: BaselineEntry[];
}

export function generateFingerprint(diagnostic: Diagnostic): string {
  const normFile = diagnostic.location?.file
    ? diagnostic.location.file.replace(/\\/g, "/")
    : "";
  const line = diagnostic.location?.line ?? "";
  const rawId = diagnostic.id;
  const title = diagnostic.title;

  const content = `${rawId}::${normFile}::${line}::${title}`;
  return createHash("sha256").update(content, "utf8").digest("hex").slice(0, 32);
}

export async function loadBaseline(filePath: string): Promise<BaselineData | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<BaselineData> & { version?: string; generatedAt?: string };
    if (parsed && Array.isArray(parsed.findings)) {
      return {
        schemaVersion: parsed.schemaVersion ?? 1,
        toolVersion: parsed.toolVersion ?? parsed.version ?? "0.6.0",
        root: parsed.root ?? ".",
        createdAt: parsed.createdAt ?? parsed.generatedAt ?? new Date().toISOString(),
        findings: parsed.findings,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveBaseline(
  filePath: string,
  diagnostics: Diagnostic[],
  options: { root?: string; toolVersion?: string } = {},
): Promise<void> {
  // Only save failing/actionable diagnostics in baseline (skip pure success/info)
  const actionable = diagnostics.filter(
    (d) => d.severity === "critical" || d.severity === "warning",
  );

  const findings: BaselineEntry[] = actionable.map((d) => {
    const ruleBaseId = d.id.split(":")[0] || d.id;
    const normFile = d.location?.file ? d.location.file.replace(/\\/g, "/") : undefined;

    return {
      id: d.id,
      ruleId: ruleBaseId,
      ruleVersion: "1",
      fingerprint: d.fingerprint ?? generateFingerprint(d),
      file: normFile,
      line: d.location?.line,
      title: d.title,
    };
  });

  const data: BaselineData = {
    schemaVersion: 1,
    toolVersion: options.toolVersion ?? "0.6.0",
    root: options.root ?? ".",
    createdAt: new Date().toISOString(),
    findings,
  };

  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function filterBaselineDiagnostics(
  diagnostics: Diagnostic[],
  baseline: BaselineData | null,
): { newFindings: Diagnostic[]; baselineMatchedCount: number; staleFindings: BaselineEntry[] } {
  if (!baseline || baseline.findings.length === 0) {
    return { newFindings: diagnostics, baselineMatchedCount: 0, staleFindings: [] };
  }

  const knownFingerprints = new Set(baseline.findings.map((f) => f.fingerprint));
  const matchedFingerprints = new Set<string>();
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
      matchedFingerprints.add(fp);
      diagnostic.suppressed = true;
      diagnostic.fingerprint = fp;
    } else {
      diagnostic.fingerprint = fp;
      newFindings.push(diagnostic);
    }
  }

  // Stale findings are items in baseline that were not observed in the current scan
  const staleFindings = baseline.findings.filter((f) => !matchedFingerprints.has(f.fingerprint));

  return { newFindings, baselineMatchedCount, staleFindings };
}
