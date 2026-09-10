import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { parseIgnoreFile, validateIgnoreRule } from "../src/core/ignore.js";
import { saveBaseline, loadBaseline, generateFingerprint } from "../src/core/baseline.js";
import { scanProject } from "../src/core/scanner.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";
import type { Diagnostic } from "../src/core/types.js";

describe("Ignore Syntax Validation and Stale Baseline Diagnostics", () => {
  describe("parseIgnoreFile syntax checking", () => {
    it("flags malformed ignore rules with syntax errors", () => {
      const content = [
        "# Valid comment",
        "node_modules/",
        "***invalid-glob",
        "[unclosed-bracket",
        "valid/path/*.log",
      ].join("\n");

      const result = parseIgnoreFile(content);
      expect(result.syntaxErrors.length).toBeGreaterThanOrEqual(1);
      expect(result.syntaxErrors.some((e) => e.line === 3)).toBe(true);
      expect(result.syntaxErrors.some((e) => e.line === 4)).toBe(true);
    });

    it("emits ignore.syntax-error diagnostic during scanProject", async () => {
      const root = await makeFixture({
        "package.json": JSON.stringify({ name: "syntax-error-ignore", version: "1.0.0" }),
        ".repodoctorignore": "***malformed-glob\n",
      });
      try {
        const result = await scanProject(root);
        const syntaxDiag = result.diagnostics.find((d) => d.id === "ignore.syntax-error");
        expect(syntaxDiag).toBeDefined();
        expect(syntaxDiag?.severity).toBe("warning");
        expect(syntaxDiag?.title).toContain("Syntax error in .repodoctorignore");
      } finally {
        await removeFixture(root);
      }
    });
  });

  describe("Baseline schema and stale finding detection", () => {
    it("saves modern schema metadata with schemaVersion 1", async () => {
      const root = await makeFixture({
        "package.json": JSON.stringify({ name: "baseline-meta-test", version: "1.0.0" }),
      });
      const baselineFile = path.join(root, ".repodoctor-baseline.json");
      const dummyDiag: Diagnostic = {
        id: "git.uncommitted",
        severity: "warning",
        title: "Uncommitted changes",
        location: { file: "src\\index.ts", line: 10 },
      };

      try {
        await saveBaseline(baselineFile, [dummyDiag]);
        const data = await loadBaseline(baselineFile);
        expect(data).not.toBeNull();
        expect(data?.schemaVersion).toBe(1);
        expect(data?.toolVersion).toBeDefined();
        expect(data?.createdAt).toBeDefined();
        expect(data?.findings).toHaveLength(1);
        // File paths normalized with forward slashes
        expect(data?.findings[0]?.file).toBe("src/index.ts");
      } finally {
        await removeFixture(root);
      }
    });

    it("emits baseline.stale diagnostic when baseline contains resolved findings", async () => {
      const root = await makeFixture({
        "package.json": JSON.stringify({ name: "stale-baseline-test", version: "1.0.0" }),
      });
      const baselineFile = path.join(root, ".repodoctor-baseline.json");

      // Finding that definitely does NOT exist in the clean fixture
      const nonExistentDiag: Diagnostic = {
        id: "packages.missing-license",
        severity: "warning",
        title: "Package is missing a license field",
      };
      const fp = generateFingerprint(nonExistentDiag);

      const baselinePayload = {
        schemaVersion: 1,
        toolVersion: "0.6.0",
        root: ".",
        createdAt: new Date().toISOString(),
        findings: [
          {
            id: nonExistentDiag.id,
            fingerprint: fp,
            title: nonExistentDiag.title,
          },
        ],
      };

      try {
        const result = await scanProject(root, { baseline: baselinePayload });
        const staleDiag = result.diagnostics.find((d) => d.id === "baseline.stale");
        expect(staleDiag).toBeDefined();
        expect(staleDiag?.title).toBe("Stale baseline findings detected");
        expect(staleDiag?.message).toContain("recorded in baseline are no longer present in repository");
      } finally {
        await removeFixture(root);
      }
    });
  });
});
