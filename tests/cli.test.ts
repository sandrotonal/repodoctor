import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import pkg from "../package.json" with { type: "json" };
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

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

describe("repodoctor CLI", () => {
  it("outputs the version with --version", async () => {
    const { stdout, code } = await runCli(["--version"]);
    expect(code).toBe(0);
    expect(stdout.trim()).toBe(pkg.version);
  });

  it("outputs help with --help", async () => {
    const { stdout, code } = await runCli(["--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("repodoctor");
  });

  it("prints the banner when run without arguments", async () => {
    const { stdout, code } = await runCli([]);
    expect(code).toBe(0);
    expect(stdout).toContain("RepoDoctor");
    expect(stdout).toContain("Scanning project...");
  });

  it("renders the panel style without animation in non-TTY mode", async () => {
    const { stdout, code } = await runCli(["--style", "panel"]);
    expect(code).toBe(0);
    expect(stdout).toContain("╔");
    expect(stdout).toContain("R E P O D O C T O R");
    expect(stdout).toContain("Health");
  });

  it("outputs valid JSON and a health score with --json", async () => {
    const { stdout, code } = await runCli(["--json"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout) as { root: string; diagnostics: { id: string }[]; health: { score: number } };
    expect(parsed.root).toBeTruthy();
    expect(Array.isArray(parsed.diagnostics)).toBe(true);
    expect(typeof parsed.health.score).toBe("number");
  });

  it("keeps stdout pure JSON when combining --json with --fix", async () => {
    const root = await makeFixture({ ".env": "API_KEY=secret\n", ".env.example": "API_KEY=\n" });
    try {
      const { stdout } = await runCli([root, "--json", "--fix"]);
      const parsed = JSON.parse(stdout) as { root: string };
      expect(parsed.root).toBeTruthy();
    } finally {
      await removeFixture(root);
    }
  });

  it("exports HTML report with --html", async () => {
    const root = await makeFixture({ "package.json": JSON.stringify({ name: "html-test" }) });
    const htmlPath = path.join(root, "test-report.html");
    try {
      const { code } = await runCli([root, "--html", htmlPath]);
      expect(code).toBe(0);
      const content = await readFile(htmlPath, "utf8");
      expect(content).toContain("RepoDoctor Diagnostic Report");
      expect(content).toContain("html-test");
    } finally {
      await removeFixture(root);
    }
  });

  it("exports SARIF report with --sarif", async () => {
    const root = await makeFixture({ "package.json": JSON.stringify({ name: "sarif-test" }) });
    const sarifPath = path.join(root, "test-report.sarif");
    try {
      const { code } = await runCli([root, "--sarif", sarifPath]);
      expect(code).toBe(0);
      const content = await readFile(sarifPath, "utf8");
      const parsed = JSON.parse(content);
      expect(parsed.version).toBe("2.1.0");
      expect(parsed.runs[0].tool.driver.name).toBe("RepoDoctor");
    } finally {
      await removeFixture(root);
    }
  });

  it("installs git hook with init-hook command", async () => {
    const root = await makeFixture({ ".git": "dir" });
    try {
      const { stdout, code } = await runCli(["init-hook", root]);
      expect(code).toBe(0);
      expect(stdout).toContain("RepoDoctor pre-commit hook successfully installed");
    } finally {
      await removeFixture(root);
    }
  });

  it("exports Markdown report with --markdown", async () => {
    const root = await makeFixture({ "package.json": JSON.stringify({ name: "markdown-test" }) });
    const mdPath = path.join(root, "summary.md");
    try {
      const { code } = await runCli([root, "--markdown", mdPath]);
      expect(code).toBe(0);
      const content = await readFile(mdPath, "utf8");
      expect(content).toContain("# 🩺 RepoDoctor Diagnostic Report");
      expect(content).toContain("| **Health Score** |");
    } finally {
      await removeFixture(root);
    }
  });

  it("installs CI workflow with init-ci command", async () => {
    const root = await makeFixture({ "package.json": JSON.stringify({ name: "ci-test" }) });
    try {
      const { stdout, code } = await runCli(["init-ci", root]);
      expect(code).toBe(0);
      expect(stdout).toContain("Successfully generated GitHub Actions workflow");
    } finally {
      await removeFixture(root);
    }
  });
});
