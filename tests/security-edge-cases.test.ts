import { describe, expect, it } from "vitest";
import { generateHtmlReport } from "../src/output/html.js";
import { generateMarkdownReport } from "../src/output/markdown.js";
import { generateSarifReport } from "../src/output/sarif.js";
import { formatScan, sanitizeAnsi } from "../src/output/terminal.js";
import { formatJson } from "../src/output/json.js";
import { scanProject } from "../src/core/scanner.js";
import { isPathSafe } from "../src/fixes.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";
import type { Diagnostic, ScanResult } from "../src/core/types.js";

describe("Security Edge-Cases & Hardening Suite", () => {
  function createMockScanResult(diagnostics: Diagnostic[]): ScanResult {
    return {
      root: "/mock/repo",
      projectDetected: true,
      packageJsonExists: true,
      gitRepo: true,
      nodeModulesInstalled: true,
      envFileExists: false,
      envExampleExists: false,
      envFiles: [],
      packageManager: { manager: "npm", lockFiles: ["package-lock.json"], ambiguous: false },
      packageJson: { exists: true, content: { name: "test-pkg" }, parseError: null },
      diagnostics,
      health: {
        score: 80,
        grade: "good",
        securityScore: 80,
        reliabilityScore: 90,
      },
      coverage: {
        filesDiscovered: 10,
        filesScanned: 8,
        filesSkipped: 2,
        durationMs: 15,
        scanLimitReached: false,
        bytesScanned: 1024,
        peakMemoryMb: 45,
        skippedReasons: {
          ignored: 1,
          binary: 1,
          tooLarge: 0,
          permissionDenied: 0,
          unsupportedExtension: 0,
          scanLimit: 0,
        },
      },
    };
  }

  describe("HTML Report XSS Escaping", () => {
    it("escapes malicious scripts and html entities in titles, messages, and package names", () => {
      const maliciousDiagnostics: Diagnostic[] = [
        {
          id: "security.xss-test",
          severity: "critical",
          title: "<script>alert('xss-title')</script>",
          message: '"><img src=x onerror=alert("xss-message")>',
          recommendation: "Use & validate <input onfocus=alert(1)>",
        },
      ];

      const scanResult = createMockScanResult(maliciousDiagnostics);
      const html = generateHtmlReport(scanResult);

      expect(html).not.toContain("<script>alert('xss-title')</script>");
      expect(html).not.toContain('<img src=x onerror=alert("xss-message")>');
      expect(html).not.toContain("<input onfocus=alert(1)>");

      expect(html).toContain("&lt;script&gt;alert(&#039;xss-title&#039;)&lt;/script&gt;");
      expect(html).toContain("&quot;&gt;&lt;img src=x onerror=alert(&quot;xss-message&quot;)&gt;");
    });
  });

  describe("Markdown Report Injection Hardening", () => {
    it("sanitizes pipe characters and html tags to prevent table and markdown injection", () => {
      const maliciousDiagnostics: Diagnostic[] = [
        {
          id: "security.md-injection",
          severity: "warning",
          title: "Evil | Injected | Column",
          message: "Line 1\nLine 2\r\nLine 3 <script>evil()</script>",
          recommendation: "Fix | please",
        },
      ];

      const scanResult = createMockScanResult(maliciousDiagnostics);
      const md = generateMarkdownReport(scanResult);

      expect(md).not.toContain("<script>evil()</script>");
      expect(md).toContain("&lt;script&gt;evil()&lt;/script&gt;");
      expect(md).toContain("Evil \\| Injected \\| Column");
    });
  });

  describe("SARIF Report JSON Integrity", () => {
    it("produces valid, parseable SARIF JSON even with special characters and quotes", () => {
      const complexDiagnostics: Diagnostic[] = [
        {
          id: "security.sarif-chars",
          severity: "critical",
          title: 'Special "quotes", \\backslashes\\ and \nnewlines',
          message: 'Message with "nested" \'quotes\' and emoji-free symbols',
          location: { file: 'path/with"quotes"/file.ts', line: 12 },
        },
      ];

      const scanResult = createMockScanResult(complexDiagnostics);
      const sarif = generateSarifReport(scanResult);

      const parsed = JSON.parse(sarif);
      expect(parsed.version).toBe("2.1.0");
      expect(parsed.runs[0].results.length).toBe(1);
      expect(parsed.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri).toBe(
        'path/with"quotes"/file.ts',
      );
    });
  });

  describe("Terminal ANSI Control Sequence Sanitization", () => {
    it("strips ANSI control sequences and terminal reset codes", () => {
      const maliciousText = "\u001b[2J\u001b[H\u001b[31mInjected Red\u001b[0m\x00\x07";
      const sanitized = sanitizeAnsi(maliciousText);

      expect(sanitized).not.toContain("\u001b");
      expect(sanitized).not.toContain("\x00");
      expect(sanitized).not.toContain("\x07");
      expect(sanitized).toBe("Injected Red");
    });
  });

  describe("Path Traversal & Boundaries", () => {
    it("isPathSafe correctly detects traversal attempts outside directory", async () => {
      const fixture = await makeFixture({
        "normal/file.ts": "export const x = 1;",
      });
      try {
        expect(isPathSafe(fixture, "normal/file.ts")).toBe(true);
        expect(isPathSafe(fixture, "../../outside.ts")).toBe(false);
        expect(isPathSafe(fixture, "..\\..\\outside.ts")).toBe(false);
      } finally {
        await removeFixture(fixture);
      }
    });
  });

  describe("Zero Raw Secret Leakage", () => {
    it("never exposes raw secret in any report format (terminal, json, html, sarif, md)", async () => {
      const rawSecret = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
      const fixture = await makeFixture({
        "package.json": JSON.stringify({ name: "leak-test" }),
        "src/auth.ts": `const token = "${rawSecret}";\n`,
      });

      try {
        const scanResult = await scanProject(fixture);
        const jsonOut = formatJson(scanResult);
        const htmlOut = generateHtmlReport(scanResult);
        const sarifOut = generateSarifReport(scanResult);
        const mdOut = generateMarkdownReport(scanResult);
        const termOut = formatScan(scanResult, "plain");

        // Verify finding was detected
        const findings = scanResult.diagnostics.filter((d) => d.id.startsWith("secret."));
        expect(findings.length).toBeGreaterThan(0);

        // Verify RAW secret is never leaked in ANY format
        expect(jsonOut).not.toContain(rawSecret);
        expect(htmlOut).not.toContain(rawSecret);
        expect(sarifOut).not.toContain(rawSecret);
        expect(mdOut).not.toContain(rawSecret);
        expect(termOut).not.toContain(rawSecret);

        // Verify masked version is present
        expect(jsonOut).toContain("ghp_****xyz");
      } finally {
        await removeFixture(fixture);
      }
    });
  });
});
