import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { installPreCommitHook } from "../src/hooks.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

describe("Pre-commit Hook Installer", () => {
  it("installs pre-commit hook in a git repo", async () => {
    const fixture = await makeFixture({
      ".git": "dir",
    });

    try {
      const result = await installPreCommitHook(fixture);
      expect(result.success).toBe(true);
      expect(result.hookPath).toBeDefined();

      const content = await readFile(path.join(fixture, ".git", "hooks", "pre-commit"), "utf8");
      expect(content).toContain("RepoDoctor Pre-commit Hook");
      expect(content).toContain("npx @gucluyumhe/repodoctor --ci");
    } finally {
      await removeFixture(fixture);
    }
  });

  it("fails gracefully when not in a git repo", async () => {
    const fixture = await makeFixture({
      "package.json": "{}",
    });

    try {
      const result = await installPreCommitHook(fixture);
      expect(result.success).toBe(false);
      expect(result.message).toContain("Not a git repository");
    } finally {
      await removeFixture(fixture);
    }
  });
});
