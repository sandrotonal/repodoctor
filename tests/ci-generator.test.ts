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
});
