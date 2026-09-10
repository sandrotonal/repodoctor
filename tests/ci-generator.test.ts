import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { installCiWorkflow } from "../src/ci-generator.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

describe("CI Workflow Generator", () => {
  it("generates valid .github/workflows/repodoctor.yml", async () => {
    const fixture = await makeFixture({
      "package.json": "{}",
    });

    try {
      const result = await installCiWorkflow(fixture);
      expect(result.success).toBe(true);
      expect(result.workflowPath).toBeDefined();

      const content = await readFile(path.join(fixture, ".github", "workflows", "repodoctor.yml"), "utf8");
      expect(content).toContain("RepoDoctor Health & Security Scan");
      expect(content).toContain("npx @gucluyumhe/repodoctor --ci --sarif repodoctor.sarif");
      expect(content).toContain("upload-sarif@v3");
    } finally {
      await removeFixture(fixture);
    }
  });

  it("generates tailored workflows for pnpm, yarn and bun", async () => {
    const fixture = await makeFixture({
      "package.json": "{}",
    });

    try {
      // pnpm
      const pnpmRes = await installCiWorkflow(fixture, { force: true, packageManager: "pnpm" });
      expect(pnpmRes.success).toBe(true);
      let content = await readFile(path.join(fixture, ".github", "workflows", "repodoctor.yml"), "utf8");
      expect(content).toContain("Setup pnpm");
      expect(content).toContain("pnpm dlx @gucluyumhe/repodoctor");

      // yarn
      const yarnRes = await installCiWorkflow(fixture, { force: true, packageManager: "yarn" });
      expect(yarnRes.success).toBe(true);
      content = await readFile(path.join(fixture, ".github", "workflows", "repodoctor.yml"), "utf8");
      expect(content).toContain("yarn dlx @gucluyumhe/repodoctor");

      // bun
      const bunRes = await installCiWorkflow(fixture, { force: true, packageManager: "bun" });
      expect(bunRes.success).toBe(true);
      content = await readFile(path.join(fixture, ".github", "workflows", "repodoctor.yml"), "utf8");
      expect(content).toContain("Setup Bun");
      expect(content).toContain("bunx @gucluyumhe/repodoctor");
    } finally {
      await removeFixture(fixture);
    }
  });
});
