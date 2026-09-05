import { describe, it, expect } from "vitest";
import { generateMarkdownReport } from "../src/output/markdown.js";
import type { ScanResult } from "../src/core/types.js";

function createMockResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    root: "/workspace/test-project",
    projectDetected: true,
    packageJsonExists: true,
    gitRepo: true,
    nodeModulesInstalled: true,
    envFileExists: true,
    envExampleExists: true,
    envFiles: [".env"],
    packageManager: { manager: "npm", lockFiles: ["package-lock.json"], ambiguous: false },
    packageJson: { exists: true, content: { name: "test-app" }, parseError: null },
    diagnostics: [
      {
        id: "project.package-json",
        severity: "success",
        title: "package.json detected",
      },
      {
        id: "packages.deprecated:request",
        severity: "warning",
        title: "Deprecated package detected: 'request'",
        message: "Package has been deprecated. | Pipe check",
        recommendation: "Use fetch or axios.",
      },
      {
        id: "secret.google-gemini",
        severity: "critical",
        title: "Google Gemini API Key exposed",
        message: "File: src/config.ts\nLine: 5",
        recommendation: "Revoke immediately and move to environment variables.",
      },
    ],
    health: {
      score: 75,
      grade: "fair",
    },
    ...overrides,
  };
}

describe("generateMarkdownReport", () => {
  it("renders a valid GitHub Flavored Markdown report", () => {
    const result = createMockResult();
    const md = generateMarkdownReport(result);

    expect(md).toContain("# 🩺 RepoDoctor Diagnostic Report");
    expect(md).toContain("| **Health Score** | 75/100 (FAIR) |");
    expect(md).toContain("| **Critical Issues** | 1 |");
    expect(md).toContain("| **Warnings** | 1 |");
    expect(md).toContain("| **Passing Checks** | 1 |");
    expect(md).toContain("🔴 **Critical**");
    expect(md).toContain("🟡 **Warning**");
    expect(md).toContain("Google Gemini API Key exposed");
    // Check that pipes and newlines are sanitized
    expect(md).toContain("Package has been deprecated. \\| Pipe check");
    expect(md).not.toContain("File: src/config.ts\nLine: 5");
    expect(md).toContain("File: src/config.ts Line: 5");
  });

  it("handles green state when no issues are found", () => {
    const result = createMockResult({
      diagnostics: [
        {
          id: "project.package-json",
          severity: "success",
          title: "package.json detected",
        },
      ],
      health: {
        score: 100,
        grade: "excellent",
      },
    });

    const md = generateMarkdownReport(result);
    expect(md).toContain("All systems green!");
    expect(md).not.toContain("### ⚠️ Findings & Recommendations");
    expect(md).toContain("<summary><b>Passed Checks (1)</b></summary>");
  });
});
