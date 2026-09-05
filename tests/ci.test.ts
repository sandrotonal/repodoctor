import { describe, expect, it } from "vitest";
import { detectCiWorkflows } from "../src/detectors/ci.js";
import { checkCi } from "../src/checks/ci.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

describe("CI/CD Workflows Detector", () => {
  it("warns about outdated actions in workflows", async () => {
    const fixture = await makeFixture({
      ".github/workflows/ci.yml": `
name: CI
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      `,
    });

    try {
      const result = await detectCiWorkflows(fixture);
      expect(result.hasCi).toBe(true);
      expect(result.workflowFiles).toContain("ci.yml");
      expect(result.issues.length).toBe(2);

      const diags = checkCi(result);
      expect(diags.some((d) => d.id.includes("ci.issue") && d.severity === "warning")).toBe(true);
    } finally {
      await removeFixture(fixture);
    }
  });

  it("recommends init-ci when no workflows exist", async () => {
    const fixture = await makeFixture({
      "package.json": "{}",
    });

    try {
      const result = await detectCiWorkflows(fixture);
      expect(result.hasCi).toBe(false);

      const diags = checkCi(result);
      expect(diags.some((d) => d.id === "ci.not-configured")).toBe(true);
    } finally {
      await removeFixture(fixture);
    }
  });
});
