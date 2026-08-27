import { describe, expect, it } from "vitest";
import { generateHtmlReport } from "../src/output/html.js";
import { generateSarifReport } from "../src/output/sarif.js";
import type { ScanResult } from "../src/core/types.js";

describe("Reporters (HTML & SARIF)", () => {
  const mockScanResult: ScanResult = {
    root: "/workspace/my-app",
    projectDetected: true,
    packageJsonExists: true,
    gitRepo: true,
    nodeModulesInstalled: true,
    envFileExists: true,
    envExampleExists: false,
    envFiles: [".env"],
    packageManager: { manager: "npm", lockFiles: ["package-lock.json"], ambiguous: false },
    packageJson: { exists: true, content: { name: "my-app" }, parseError: null },
    diagnostics: [
      {
        id: "project.package-json",
        severity: "success",
        title: "package.json detected",
      },
      {
        id: "secret.aws-key:src/index.ts:15",
        severity: "critical",
        title: "Potential AWS Access Key leak detected",
        message: "Found in src/index.ts:15 (AKIA****PLE)",
        recommendation: "Move secret to .env file.",
      },
      {
        id: "env.example-missing",
        severity: "info",
        title: "No .env.example found",
        message: "A local .env exists but there is no .env.example.",
      },
    ],
    health: {
      score: 75,
      grade: "fair",
    },
  };

  it("generates standalone interactive HTML report", () => {
    const html = generateHtmlReport(mockScanResult);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("RepoDoctor Diagnostic Report");
    expect(html).toContain("/workspace/my-app");
    expect(html).toContain("Potential AWS Access Key leak detected");
    expect(html).toContain("Move secret to .env file.");
    expect(html).toContain("75");
  });

  it("generates valid SARIF 2.1.0 report with rules and locations", () => {
    const sarifJson = generateSarifReport(mockScanResult, "0.3.0");
    const parsed = JSON.parse(sarifJson);

    expect(parsed.version).toBe("2.1.0");
    expect(parsed.$schema).toContain("sarif-schema-2.1.0.json");
    expect(parsed.runs[0].tool.driver.name).toBe("RepoDoctor");
    expect(parsed.runs[0].results.length).toBe(2); // Critical and info (success omitted)

    const criticalResult = parsed.runs[0].results.find((r: { level: string }) => r.level === "error");
    expect(criticalResult).toBeDefined();
    expect(criticalResult.ruleId).toBe("secret.aws-key");
    expect(criticalResult.locations[0].physicalLocation.artifactLocation.uri).toBe("src/index.ts");
    expect(criticalResult.locations[0].physicalLocation.region.startLine).toBe(15);
  });
});
