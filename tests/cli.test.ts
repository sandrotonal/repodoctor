import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import pkg from "../package.json" with { type: "json" };
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

const execFileAsync = promisify(execFile);
const distEntry = fileURLToPath(new URL("../dist/index.js", import.meta.url));

async function runCli(args: string[]): Promise<{ stdout: string; code: number }> {
  try {
    const { stdout } = await execFileAsync(process.execPath, [distEntry, ...args]);
    return { stdout, code: 0 };
  } catch (error) {
    const e = error as { stdout?: string; code?: number };
    return { stdout: e.stdout ?? "", code: e.code ?? 1 };
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
});
