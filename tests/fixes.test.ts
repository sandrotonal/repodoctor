import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyFixes } from "../src/fixes.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

describe("Smart Auto-Fix Engine", () => {
  it("generates .env.example from .env keys", async () => {
    const fixture = await makeFixture({
      ".env": "DATABASE_URL=postgres://...\nAPI_KEY=secret123\nPORT=3000\n",
    });

    try {
      const { applied } = await applyFixes(fixture, [
        {
          id: "env.example-missing",
          severity: "info",
          title: "No .env.example found",
        },
      ]);

      expect(applied.length).toBe(1);
      const exampleContent = await readFile(path.join(fixture, ".env.example"), "utf8");
      expect(exampleContent).toContain("DATABASE_URL=");
      expect(exampleContent).toContain("API_KEY=");
      expect(exampleContent).toContain("PORT=");
      // Values should not be leaked in example
      expect(exampleContent).not.toContain("secret123");
    } finally {
      await removeFixture(fixture);
    }
  });

  it("creates .dockerignore with required exclusions", async () => {
    const fixture = await makeFixture({
      Dockerfile: "FROM node:18\n",
    });

    try {
      const { applied } = await applyFixes(fixture, [
        {
          id: "docker.missing-dockerignore",
          severity: "warning",
          title: "Dockerfile present without .dockerignore",
        },
      ]);

      expect(applied.length).toBe(1);
      const dockerignore = await readFile(path.join(fixture, ".dockerignore"), "utf8");
      expect(dockerignore).toContain("node_modules");
      expect(dockerignore).toContain(".env");
      expect(dockerignore).toContain(".git");
    } finally {
      await removeFixture(fixture);
    }
  });

  it("adds exposed sensitive files to .gitignore", async () => {
    const fixture = await makeFixture({
      id_rsa: "private-key",
      ".gitignore": "node_modules\n",
    });

    try {
      const { applied } = await applyFixes(fixture, [
        {
          id: "security.exposed-file:id_rsa",
          severity: "critical",
          title: "Sensitive file exposed",
        },
      ]);

      expect(applied.length).toBe(1);
      const gitignore = await readFile(path.join(fixture, ".gitignore"), "utf8");
      expect(gitignore).toContain("id_rsa");
    } finally {
      await removeFixture(fixture);
    }
  });
});
