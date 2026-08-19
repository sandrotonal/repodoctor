import { describe, it, expect } from "vitest";
import type { Diagnostic, ScanResult } from "../src/core/types.js";
import { formatScan } from "../src/output/terminal.js";
import { gradient, segmentBar, wordWrap } from "../src/output/theme.js";

const diagnostics: Diagnostic[] = [
  { id: "project.directory", severity: "success", title: "Project directory detected" },
  { id: "node.version", severity: "info", title: "Node.js v22 detected", message: "Example folder" },
  {
    id: "node-version.mismatch",
    severity: "warning",
    title: "Node version mismatch",
    message: "Required >=18, found >=16",
    recommendation: "Update the engines field.",
  },
  { id: "env.missing-key", severity: "warning", title: "Missing env key" },
  { id: "git.dirty", severity: "critical", title: "Dirty worktree" },
  { id: "port.conflict", severity: "warning", title: "Port 3000 in use" },
  { id: "dependencies.unused", severity: "info", title: "Unused dependency" },
];

const result: ScanResult = {
  root: "example",
  projectDetected: true,
  packageJsonExists: true,
  gitRepo: true,
  nodeModulesInstalled: true,
  envFileExists: true,
  envExampleExists: true,
  envFiles: [".env"],
  packageManager: { manager: "npm", lockFiles: ["package-lock.json"], ambiguous: false },
  packageJson: { exists: true, content: null, parseError: null },
  diagnostics,
  health: { score: 92, grade: "excellent" },
};

describe("formatScan (plain)", () => {
  it("keeps the classic banner and diagnostic lines", () => {
    const output = formatScan(result, "plain");
    expect(output).toContain("RepoDoctor");
    expect(output).toContain("Scanning project...");
    expect(output).toContain("[OK] Project directory detected");
    expect(output).toContain("[WARN] Node version mismatch");
    expect(output).toContain("[FAIL] Dirty worktree");
    expect(output).toContain("[INFO] Node.js v22 detected");
    expect(output).toContain("-> Update the engines field.");
    expect(output).toContain("Health score: 92/100 (EXCELLENT)");
    expect(output).toContain("Scan completed.");
  });

  it("does not use box-drawing characters", () => {
    const output = formatScan(result, "plain");
    expect(output).not.toContain("╔");
    expect(output).not.toContain("│");
  });
});

describe("formatScan (panel)", () => {
  it("renders a bordered header, category panels and a health panel", () => {
    const output = formatScan(result, "panel");
    expect(output).toContain("╔");
    expect(output).toContain("R E P O D O C T O R");
    expect(output).toContain("Node.js");
    expect(output).toContain("[WARN] Node version mismatch");
    expect(output).toContain("[FAIL] Dirty worktree");
    expect(output).toContain("Health 92/100 EXCELLENT");
    expect(output).toContain("Scan completed.");
  });

  it("groups diagnostics under their category", () => {
    const output = formatScan(result, "panel");
    const project = output.indexOf("Project");
    const node = output.indexOf("Node.js");
    expect(node).toBeGreaterThan(project);
    expect(output.indexOf("Port 3000 in use")).toBeGreaterThan(node);
  });

  it("renders the segment health bar", () => {
    const output = formatScan(result, "panel");
    expect(output).toContain("█");
    expect(output).toContain("░");
  });

  it("does not print the scanning notice (animation covers it)", () => {
    const output = formatScan(result, "panel");
    expect(output).not.toContain("Scanning project...");
  });
});

describe("theme helpers", () => {
  it("gradient preserves the source text when ANSI codes are stripped", () => {
    const colored = gradient("Hello", [0, 0, 0], [255, 255, 255]);
    expect(colored.replace(/\x1b\[[0-9;]*m/g, "")).toBe("Hello");
  });

  it("segmentBar fills and empties with block characters", () => {
    expect(segmentBar(0.5, 10)).toBe("█████░░░░░");
    expect(segmentBar(1, 4)).toBe("████");
    expect(segmentBar(0, 3)).toBe("░░░");
  });

  it("wordWrap splits long text at the given width", () => {
    const lines = wordWrap("one two three four", 10);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => line.length <= 10)).toBe(true);
  });
});