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
    expect(computeHealthScore([])).toEqual({ score: 100, grade: "excellent" });
  });

  it("drops 30 per critical and 8 per warning", () => {
    expect(computeHealthScore([diagnostic("critical")])).toEqual({ score: 70, grade: "fair" });
    expect(computeHealthScore([diagnostic("warning")])).toEqual({ score: 92, grade: "excellent" });
    expect(computeHealthScore([diagnostic("critical"), diagnostic("warning")])).toEqual({ score: 62, grade: "fair" });
  });

  it("clamps at zero", () => {
    expect(computeHealthScore([diagnostic("critical"), diagnostic("critical"), diagnostic("critical"), diagnostic("critical")])).toEqual({
      score: 0,
      grade: "critical",
    });
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