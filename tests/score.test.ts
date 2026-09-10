import { describe, it, expect } from "vitest";
import { computeHealthScore } from "../src/core/score.js";
import { applyFixes } from "../src/fixes.js";
import type { Diagnostic } from "../src/core/types.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

function diagnostic(severity: Diagnostic["severity"]): Diagnostic {
  return { id: `test.${severity}`, severity, title: severity };
}

describe("computeHealthScore", () => {
  it("scores 100 on a clean scan", () => {
    const health = computeHealthScore([]);
    expect(health.score).toBe(100);
    expect(health.overallScore).toBe(100);
    expect(health.grade).toBe("excellent");
    expect(health.securityScore).toBe(100);
    expect(health.securityGrade).toBe("excellent");
    expect(health.reliabilityScore).toBe(100);
    expect(health.reliabilityGrade).toBe("excellent");
  });

  it("does not penalize informational diagnostics", () => {
    const health = computeHealthScore([diagnostic("info"), diagnostic("success")]);
    expect(health.score).toBe(100);
    expect(health.grade).toBe("excellent");
  });

  it("drops 30 per critical and 8 per warning for overall score", () => {
    expect(computeHealthScore([diagnostic("critical")]).score).toBe(70);
    expect(computeHealthScore([diagnostic("warning")]).score).toBe(92);
    expect(computeHealthScore([diagnostic("critical"), diagnostic("warning")]).score).toBe(62);
  });

  it("calculates decoupled security vs reliability scores", () => {
    const secIssue: Diagnostic = {
      id: "security.secret-exposed",
      severity: "critical",
      title: "Secret exposed",
      category: "security",
    };
    const relIssue: Diagnostic = {
      id: "node.deprecated-version",
      severity: "warning",
      title: "Node deprecated",
      category: "reliability",
    };

    const health = computeHealthScore([secIssue, relIssue]);
    // Security score penalizes secIssue (100 - 35 = 65)
    expect(health.securityScore).toBe(65);
    // Reliability score penalizes relIssue (100 - 8 = 92)
    expect(health.reliabilityScore).toBe(92);
    // Overall score penalizes both (100 - 30 - 8 = 62)
    expect(health.overallScore).toBe(62);
  });

  it("clamps at zero", () => {
    const health = computeHealthScore([
      diagnostic("critical"),
      diagnostic("critical"),
      diagnostic("critical"),
      diagnostic("critical"),
    ]);
    expect(health.score).toBe(0);
    expect(health.grade).toBe("critical");
  });
});

describe("applyFixes", () => {
  it("adds .env to .gitignore when missing", async () => {
    const root = await makeFixture({ ".env": "PORT=3000\n" });
    try {
      const report = await applyFixes(root, [{ id: "env.not-gitignored", severity: "warning", title: "x" }]);
      expect(report.applied).toContain("Added .env and .env.local to .gitignore");
    } finally {
      await removeFixture(root);
    }
  });

  it("creates .env from .env.example with empty values", async () => {
    const root = await makeFixture({ ".env.example": "PORT=\nDATABASE_URL=\n" });
    try {
      const report = await applyFixes(root, [{ id: "env.missing", severity: "warning", title: "x" }]);
      expect(report.applied).toContain("Created .env from .env.example template");
      expect(report.applied).toHaveLength(1);
    } finally {
      await removeFixture(root);
    }
  });

  it("does not apply fixes for unrelated diagnostics", async () => {
    const root = await makeFixture({});
    try {
      const report = await applyFixes(root, [{ id: "port.conflict", severity: "warning", title: "x" }]);
      expect(report.applied).toEqual([]);
    } finally {
      await removeFixture(root);
    }
  });
});