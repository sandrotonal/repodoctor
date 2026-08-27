import type { Diagnostic, ScanResult, Severity } from "../core/types.js";

interface SarifRule {
  id: string;
  shortDescription: { text: string };
  fullDescription?: { text: string };
  helpUri?: string;
  defaultConfiguration: {
    level: "error" | "warning" | "note" | "none";
  };
}

interface SarifResult {
  ruleId: string;
  level: "error" | "warning" | "note" | "none";
  message: { text: string };
  locations?: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region?: { startLine: number };
    };
  }>;
}

interface SarifLog {
  $schema: string;
  version: string;
  runs: Array<{
    tool: {
      driver: {
        name: string;
        version: string;
        informationUri: string;
        rules: SarifRule[];
      };
    };
    results: SarifResult[];
  }>;
}

function severityToSarifLevel(severity: Severity): "error" | "warning" | "note" | "none" {
  switch (severity) {
    case "critical":
      return "error";
    case "warning":
      return "warning";
    case "info":
      return "note";
    case "success":
      return "none";
  }
}

export function generateSarifReport(scanResult: ScanResult, version: string = "0.3.0"): string {
  const rulesMap = new Map<string, SarifRule>();
  const results: SarifResult[] = [];

  for (const diag of scanResult.diagnostics) {
    if (diag.severity === "success") continue; // SARIF only tracks findings/issues

    // Extract base rule ID
    const ruleBaseId = diag.id.split(":")[0] || diag.id;
    if (!rulesMap.has(ruleBaseId)) {
      rulesMap.set(ruleBaseId, {
        id: ruleBaseId,
        shortDescription: { text: diag.title },
        defaultConfiguration: {
          level: severityToSarifLevel(diag.severity),
        },
      });
    }

    // Check if ID contains file & line info (e.g. secret.aws-key:src/index.ts:12)
    const segments = diag.id.split(":");
    let fileUri: string | undefined;
    let lineNum: number | undefined;

    if (segments.length >= 3) {
      fileUri = segments[1];
      lineNum = Number(segments[2]) || undefined;
    }

    const messageText = [diag.title, diag.message, diag.recommendation ? `Fix: ${diag.recommendation}` : null]
      .filter(Boolean)
      .join(" - ");

    const resultItem: SarifResult = {
      ruleId: ruleBaseId,
      level: severityToSarifLevel(diag.severity),
      message: { text: messageText },
    };

    if (fileUri) {
      resultItem.locations = [
        {
          physicalLocation: {
            artifactLocation: { uri: fileUri },
            ...(lineNum ? { region: { startLine: lineNum } } : {}),
          },
        },
      ];
    }

    results.push(resultItem);
  }

  const sarifLog: SarifLog = {
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "RepoDoctor",
            version,
            informationUri: "https://github.com/sandrotonal/repodoctor",
            rules: Array.from(rulesMap.values()),
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(sarifLog, null, 2);
}
