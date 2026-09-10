import { describe, it, expect } from "vitest";
import { parseIgnoreContent, isDiagnosticIgnored, createDefaultIgnoreFile } from "../src/core/ignore.js";
import { generateFingerprint, saveBaseline, loadBaseline, filterBaselineDiagnostics } from "../src/core/baseline.js";
import { scanProject } from "../src/core/scanner.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";
import type { Diagnostic } from "../src/core/types.js";
import path from "node:path";

describe("Phase 2: Ignore Engine (.repodoctorignore)", () => {
  it("parses globs and rule-specific exclusions correctly", () => {
    const content = `
# Comment line
docs/**
tests/fixtures/**

# Rule specific
secret.aws-key:examples/aws.ts
framework.tailwind:src/legacy/**
`;
    const config = parseIgnoreContent(content);
    expect(config.rules).toHaveLength(4);

    expect(config.rules[0]?.pattern).toBe("docs/**");
    expect(config.rules[0]?.ruleId).toBeUndefined();

    expect(config.rules[2]?.pattern).toBe("examples/aws.ts");
    expect(config.rules[2]?.ruleId).toBe("secret.aws-key");
  });

  it("evaluates diagnostic suppression correctly", () => {
    const content = `
tests/fixtures/**
secret.aws-key:src/sample.ts
`;
    const config = parseIgnoreContent(content);

    // General pattern match
    expect(isDiagnosticIgnored(config, "tests/fixtures/app.ts", "any.rule")).toBe(true);
    expect(isDiagnosticIgnored(config, "tests\\fixtures\\sub\\app.ts", "any.rule")).toBe(true);

    // Rule-specific pattern match
    expect(isDiagnosticIgnored(config, "src/sample.ts", "secret.aws-key")).toBe(true);
    expect(isDiagnosticIgnored(config, "src/sample.ts", "secret.github-pat")).toBe(false);

    // Unmatched path
    expect(isDiagnosticIgnored(config, "src/main.ts", "secret.aws-key")).toBe(false);
  });

  it("creates default .repodoctorignore template if not present", async () => {
    const root = await makeFixture({});
    try {
      const res1 = await createDefaultIgnoreFile(root);
      expect(res1.created).toBe(true);

      const res2 = await createDefaultIgnoreFile(root);
      expect(res2.created).toBe(false);
    } finally {
      await removeFixture(root);
    }
  });
});

describe("Phase 2: Deterministic Baseline System", () => {
  const dummyDiag: Diagnostic = {
    id: "security.leak",
    severity: "critical",
    title: "AWS Access Key exposed",
    location: { file: "src/config/aws.ts", line: 42, column: 10 },
  };

  it("generates deterministic SHA-256 fingerprint regardless of OS slashes", () => {
    const diagUnix: Diagnostic = {
      ...dummyDiag,
      location: { file: "src/config/aws.ts", line: 42, column: 10 },
    };
    const diagWin: Diagnostic = {
      ...dummyDiag,
      location: { file: "src\\config\\aws.ts", line: 42, column: 10 },
    };

    const fp1 = generateFingerprint(diagUnix);
    const fp2 = generateFingerprint(diagWin);

    expect(fp1).toHaveLength(32);
    expect(fp1).toBe(fp2);
  });

  it("saves and loads baseline files", async () => {
    const root = await makeFixture({});
    const baselineFile = path.join(root, ".repodoctor-baseline.json");

    try {
      await saveBaseline(baselineFile, [dummyDiag]);
      const loaded = await loadBaseline(baselineFile);

      expect(loaded).not.toBeNull();
      expect(loaded?.findings).toHaveLength(1);
      expect(loaded?.findings[0]?.id).toBe("security.leak");
      expect(loaded?.findings[0]?.fingerprint).toBe(generateFingerprint(dummyDiag));
    } finally {
      await removeFixture(root);
    }
  });

  it("suppresses known baseline findings in newOnly mode", () => {
    const fp = generateFingerprint(dummyDiag);
    const baseline = {
      version: "1.0",
      generatedAt: new Date().toISOString(),
      findings: [{ id: dummyDiag.id, fingerprint: fp, title: dummyDiag.title }],
    };

    const newDiag: Diagnostic = {
      id: "git.uncommitted",
      severity: "warning",
      title: "Uncommitted changes detected",
    };

    const { newFindings, baselineMatchedCount } = filterBaselineDiagnostics(
      [dummyDiag, newDiag],
      baseline,
    );

    expect(baselineMatchedCount).toBe(1);
    expect(newFindings).toHaveLength(1);
    expect(newFindings[0]?.id).toBe("git.uncommitted");
  });

  it("integrates ignore and baseline with scanProject", async () => {
    const root = await makeFixture({
      "package.json": JSON.stringify({ name: "ignore-test", version: "1.0.0" }),
      ".repodoctorignore": "src/dummy.ts\n",
      "src/dummy.ts": "const x = 1;",
    });

    try {
      const result = await scanProject(root);
      expect(result.diagnostics.find((d) => d.location?.file?.includes("dummy.ts"))).toBeUndefined();
    } finally {
      await removeFixture(root);
    }
  });
});
