import { describe, it, expect } from "vitest";
import { applyFixes, isPathSafe, createUnifiedDiff } from "../src/fixes.js";
import { generateHtmlReport } from "../src/output/html.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { ScanResult } from "../src/core/types.js";

describe("Phase 5: Safe Auto-Fix Engine & Dry-Run", () => {
  it("generates unified diff and does NOT write files when dryRun is true", async () => {
    const fixture = await makeFixture({
      ".env.example": "PORT=3000\nSECRET=\n",
    });

    try {
      const report = await applyFixes(
        fixture,
        [{ id: "env.missing", severity: "warning", title: "Missing .env" }],
        { dryRun: true },
      );

      expect(report.applied).toContain("Created .env from .env.example template");
      expect(report.diffs.length).toBe(1);
      expect(report.diffs[0]?.file).toBe(".env");
      expect(report.diffs[0]?.diff).toContain("--- a/.env");
      expect(report.diffs[0]?.diff).toContain("+++ b/.env");
      expect(report.diffs[0]?.diff).toContain("+PORT=");

      // Verify .env was NOT created on disk
      let envExists = false;
      try {
        await stat(path.join(fixture, ".env"));
        envExists = true;
      } catch {
        envExists = false;
      }
      expect(envExists).toBe(false);
    } finally {
      await removeFixture(fixture);
    }
  });

  it("prevents path traversal attempts in auto-fixes", async () => {
    const root = "C:/fake/workspace/app";
    expect(isPathSafe(root, "C:/fake/workspace/app/.env")).toBe(true);
    expect(isPathSafe(root, "C:/fake/workspace/app/src/index.ts")).toBe(true);
    expect(isPathSafe(root, "C:/fake/workspace/other/evil.ts")).toBe(false);
    expect(isPathSafe(root, "C:/Windows/System32/evil.dll")).toBe(false);

    const fixture = await makeFixture({});
    try {
      const report = await applyFixes(fixture, [
        {
          id: "security.exposed-file:../../../../etc/passwd",
          severity: "critical",
          title: "Path traversal test",
        },
      ]);
      expect(report.applied.length).toBe(0);
    } finally {
      await removeFixture(fixture);
    }
  });

  it("generates clean unified diff formatting", () => {
    const diff = createUnifiedDiff("app.config.js", "const x = 1;\n", "const x = 1;\nconst y = 2;\n");
    expect(diff).toContain("--- a/app.config.js");
    expect(diff).toContain("+++ b/app.config.js");
    expect(diff).toContain("+const y = 2;");
  });
});

describe("Phase 5: HTML Report Hardening & XSS Sanitization", () => {
  it("thoroughly escapes malicious XSS payloads in HTML output", () => {
    const xssPayload = `<script>alert('pwned')</script><img src=x onerror="alert(1)">`;
    const mockResult: ScanResult = {
      root: `/var/www/${xssPayload}`,
      projectDetected: true,
      packageJsonExists: true,
      gitRepo: true,
      nodeModulesInstalled: true,
      envFileExists: false,
      envExampleExists: false,
      envFiles: [],
      packageManager: { manager: "npm", lockFiles: ["package-lock.json"], ambiguous: false },
      packageJson: {
        exists: true,
        content: { name: `<svg onload="alert(1)">` },
        parseError: null,
      },
      diagnostics: [
        {
          id: `security.injection:${xssPayload}`,
          severity: "critical",
          title: `XSS in Title: ${xssPayload}`,
          message: `XSS in Message: ${xssPayload}`,
          recommendation: `XSS in Fix: ${xssPayload}`,
        },
      ],
      health: {
        score: 70,
        grade: "fair",
        overallScore: 70,
        securityScore: 65,
        securityGrade: "fair",
        reliabilityScore: 100,
        reliabilityGrade: "excellent",
      },
    };

    const html = generateHtmlReport(mockResult);

    // Ensure raw unescaped HTML tags never appear
    expect(html).not.toContain("<script>alert('pwned')</script>");
    expect(html).not.toContain("<img src=x onerror=");
    expect(html).not.toContain(`<svg onload="alert(1)">`);

    // Ensure entities are properly escaped
    expect(html).toContain("&lt;script&gt;alert(&#039;pwned&#039;)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("&lt;svg onload=&quot;alert(1)&quot;&gt;");
  });
});
