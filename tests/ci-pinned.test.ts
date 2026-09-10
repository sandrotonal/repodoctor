import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { installCiWorkflow, PINNED_ACTIONS } from "../src/ci-generator.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

describe("CI Action Pinning Suite", () => {
  it("generates workflow with verified commit SHAs when pinActions is true", async () => {
    const fixture = await makeFixture({
      "package.json": "{}",
    });

    try {
      const result = await installCiWorkflow(fixture, {
        force: true,
        packageManager: "npm",
        pinActions: true,
      });

      expect(result.success).toBe(true);

      const content = await readFile(
        path.join(fixture, ".github", "workflows", "repodoctor.yml"),
        "utf8",
      );

      // Verify actions are pinned to full 40-character SHAs with version comment
      expect(content).toContain(PINNED_ACTIONS["actions/checkout@v4"]!.sha);
      expect(content).toContain("# v4.1.1");
      expect(content).toContain(PINNED_ACTIONS["actions/setup-node@v4"]!.sha);
      expect(content).toContain("# v4.0.2");
      expect(content).toContain(PINNED_ACTIONS["github/codeql-action/upload-sarif@v3"]!.sha);
      expect(content).toContain("# v3.26.2");
    } finally {
      await removeFixture(fixture);
    }
  });

  it("leaves standard tags in default mode without pinActions", async () => {
    const fixture = await makeFixture({
      "package.json": "{}",
    });

    try {
      const result = await installCiWorkflow(fixture, {
        force: true,
        packageManager: "npm",
        pinActions: false,
      });

      expect(result.success).toBe(true);

      const content = await readFile(
        path.join(fixture, ".github", "workflows", "repodoctor.yml"),
        "utf8",
      );

      expect(content).toContain("uses: actions/checkout@v4");
      expect(content).toContain("uses: actions/setup-node@v4");
      expect(content).toContain("uses: github/codeql-action/upload-sarif@v3");
    } finally {
      await removeFixture(fixture);
    }
  });
});
