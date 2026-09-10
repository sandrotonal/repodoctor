import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { EXIT_CODES, shouldFailScan } from "../src/core/exit-codes.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";
import type { Diagnostic } from "../src/core/types.js";

const execFileAsync = promisify(execFile);
const distEntry = fileURLToPath(new URL("../dist/index.js", import.meta.url));

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [distEntry, ...args]);
    return { stdout, stderr, code: 0 };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; code?: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", code: e.code ?? 1 };
  }
}

describe("Deterministic Exit Codes Contract", () => {
  describe("shouldFailScan logic", () => {
    const successDiag: Diagnostic = { id: "ok", severity: "success", title: "All good" };
    const infoDiag: Diagnostic = { id: "info", severity: "info", title: "Informational note" };
    const warnDiag: Diagnostic = { id: "warn", severity: "warning", title: "Warning issue" };
    const critDiag: Diagnostic = { id: "crit", severity: "critical", title: "Critical security leak" };

    it("returns false if only success diagnostics are present", () => {
      expect(shouldFailScan([successDiag], {})).toBe(false);
      expect(shouldFailScan([successDiag], { ci: true })).toBe(false);
      expect(shouldFailScan([successDiag], { failOn: "info" })).toBe(false);
    });

    it("defaults to failing only on critical findings in normal mode", () => {
      expect(shouldFailScan([warnDiag], {})).toBe(false);
      expect(shouldFailScan([infoDiag], {})).toBe(false);
      expect(shouldFailScan([critDiag], {})).toBe(true);
      expect(shouldFailScan([warnDiag, critDiag], {})).toBe(true);
    });

    it("fails on warnings when ci or strict is enabled", () => {
      expect(shouldFailScan([warnDiag], { ci: true })).toBe(true);
      expect(shouldFailScan([warnDiag], { strict: true })).toBe(true);
      expect(shouldFailScan([infoDiag], { ci: true })).toBe(false);
    });

    it("honors --fail-on threshold overrides regardless of case", () => {
      // failOn: critical
      expect(shouldFailScan([warnDiag], { failOn: "critical" })).toBe(false);
      expect(shouldFailScan([critDiag], { failOn: "critical" })).toBe(true);

      // failOn: warning
      expect(shouldFailScan([infoDiag], { failOn: "warning" })).toBe(false);
      expect(shouldFailScan([warnDiag], { failOn: "warning" })).toBe(true);
      expect(shouldFailScan([critDiag], { failOn: "warning" })).toBe(true);

      // failOn: info
      expect(shouldFailScan([infoDiag], { failOn: "info" })).toBe(true);
      expect(shouldFailScan([warnDiag], { failOn: "info" })).toBe(true);
    });
  });

  describe("CLI Exit Codes Execution", () => {
    it("returns exit code 0 (SUCCESS) on clean project", async () => {
      const root = await makeFixture({
        "package.json": JSON.stringify({ name: "clean-project", version: "1.0.0" }),
      });
      try {
        const { code } = await runCli([root, "--json"]);
        expect(code).toBe(EXIT_CODES.SUCCESS);
      } finally {
        await removeFixture(root);
      }
    });

    it("returns exit code 1 (FINDINGS_THRESHOLD) when issues exceed threshold", async () => {
      const root = await makeFixture({
        "package.json": JSON.stringify({ name: "warn-project", version: "1.0.0" }),
        "server.js": "const token = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';",
      });
      try {
        const { code } = await runCli([root, "--fail-on", "critical"]);
        expect(code).toBe(EXIT_CODES.FINDINGS_THRESHOLD);
      } finally {
        await removeFixture(root);
      }
    });

    it("returns exit code 2 (CLI_USAGE_ERROR) when --fail-on receives invalid severity", async () => {
      const root = await makeFixture({
        "package.json": JSON.stringify({ name: "cli-err-project" }),
      });
      try {
        const { code, stderr } = await runCli([root, "--fail-on", "ultra-severe"]);
        expect(code).toBe(EXIT_CODES.CLI_USAGE_ERROR);
        expect(stderr).toContain("Invalid --fail-on value");
      } finally {
        await removeFixture(root);
      }
    });

    it("returns exit code 3 (SCAN_ABORTED_IO) when scanning non-existent path", async () => {
      const nonExistent = "c:/non_existent_repodoctor_path_404_not_found";
      const { code, stderr } = await runCli([nonExistent]);
      expect(code).toBe(EXIT_CODES.SCAN_ABORTED_IO);
      expect(stderr).toContain("Unable to analyze the project directory");
    });

    it("returns exit code 4 (EXPORT_FAILED) when report cannot be written", async () => {
      const root = await makeFixture({
        "package.json": JSON.stringify({ name: "export-test" }),
      });
      // Point HTML to a path where parent directory does not exist
      const invalidExportPath = "c:/non_existent_folder_9999/sub/report.html";
      try {
        const { code, stderr } = await runCli([root, "--html", invalidExportPath]);
        expect(code).toBe(EXIT_CODES.EXPORT_FAILED);
        expect(stderr).toContain("Failed to export HTML report");
      } finally {
        await removeFixture(root);
      }
    });
  });
});
