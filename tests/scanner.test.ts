import { describe, it, expect } from "vitest";
import { scanProject } from "../src/core/scanner.js";
import { detectPackageManager } from "../src/detectors/package-manager.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

describe("package manager detection", () => {
  it("detects npm from package-lock.json", async () => {
    const root = await makeFixture({ "package-lock.json": "{}" });
    try {
      const result = await detectPackageManager(root);
      expect(result.manager).toBe("npm");
      expect(result.ambiguous).toBe(false);
    } finally {
      await removeFixture(root);
    }
  });

  it("detects yarn from yarn.lock", async () => {
    const root = await makeFixture({ "yarn.lock": "" });
    try {
      const result = await detectPackageManager(root);
      expect(result.manager).toBe("yarn");
    } finally {
      await removeFixture(root);
    }
  });

  it("detects pnpm from pnpm-lock.yaml", async () => {
    const root = await makeFixture({ "pnpm-lock.yaml": "" });
    try {
      const result = await detectPackageManager(root);
      expect(result.manager).toBe("pnpm");
    } finally {
      await removeFixture(root);
    }
  });

  it("detects bun from bun.lock", async () => {
    const root = await makeFixture({ "bun.lock": "" });
    try {
      const result = await detectPackageManager(root);
      expect(result.manager).toBe("bun");
    } finally {
      await removeFixture(root);
    }
  });

  it("reports ambiguity when multiple lock files exist", async () => {
    const root = await makeFixture({ "package-lock.json": "{}", "pnpm-lock.yaml": "" });
    try {
      const result = await detectPackageManager(root);
      expect(result.ambiguous).toBe(true);
      expect(result.manager).toBeNull();
      expect(result.lockFiles).toEqual(["package-lock.json", "pnpm-lock.yaml"]);
    } finally {
      await removeFixture(root);
    }
  });

  it("returns null when no lock file exists", async () => {
    const root = await makeFixture({ "package.json": "{}" });
    try {
      const result = await detectPackageManager(root);
      expect(result.manager).toBeNull();
      expect(result.ambiguous).toBe(false);
    } finally {
      await removeFixture(root);
    }
  });
});

describe("project scan", () => {
  it("detects a valid project and reports success diagnostics", async () => {
    const root = await makeFixture({
      "package.json": "{}",
      "package-lock.json": "{}",
      ".git": "dir",
      "node_modules": "dir",
      ".env": "",
      ".env.example": "",
      ".gitignore": ".env\n",
    });
    try {
      const result = await scanProject(root);
      expect(result.projectDetected).toBe(true);
      expect(result.packageJsonExists).toBe(true);
      expect(result.gitRepo).toBe(true);
      expect(result.nodeModulesInstalled).toBe(true);
      expect(result.envExampleExists).toBe(true);
      expect(result.packageManager.manager).toBe("npm");

      const ids = result.diagnostics.map((d) => d.id);
      expect(ids).toContain("project.directory");
      expect(ids).toContain("project.package-json");
      expect(ids).toContain("project.git");
      expect(ids).toContain("project.package-manager");
      expect(ids).toContain("project.node-modules");
      expect(ids).toContain("project.env-example");
      expect(result.diagnostics.every((d) => d.severity === "success" || d.severity === "info")).toBe(true);
      expect(result.health.score).toBeGreaterThan(0);
    } finally {
      await removeFixture(root);
    }
  });

  it("reports a warning when no project files are found", async () => {
    const root = await makeFixture({});
    try {
      const result = await scanProject(root);
      expect(result.projectDetected).toBe(false);
      expect(result.diagnostics.some((d) => d.id === "project.not-detected" && d.severity === "warning")).toBe(true);
    } finally {
      await removeFixture(root);
    }
  });

  it("reports a warning for multiple package managers", async () => {
    const root = await makeFixture({ "package.json": "{}", "package-lock.json": "{}", "pnpm-lock.yaml": "" });
    try {
      const result = await scanProject(root);
      const ambiguous = result.diagnostics.find((d) => d.id === "package-manager.ambiguous");
      expect(ambiguous?.severity).toBe("warning");
      expect(result.packageManager.ambiguous).toBe(true);
    } finally {
      await removeFixture(root);
    }
  });

  it("detects .env files without reporting their contents", async () => {
    const root = await makeFixture({ ".env": "DATABASE_URL=secret-value\nAPI_KEY=hunter2\n" });
    try {
      const result = await scanProject(root);
      expect(result.envFileExists).toBe(true);
      expect(result.envFiles).toEqual([".env"]);
      const envDiagnostic = result.diagnostics.find((d) => d.id === "project.env");
      expect(envDiagnostic?.title).toContain(".env");
      const allText = JSON.stringify(result);
      expect(allText).not.toContain("secret-value");
      expect(allText).not.toContain("hunter2");
    } finally {
      await removeFixture(root);
    }
  });

  it("does not report node_modules as installed when it is missing", async () => {
    const root = await makeFixture({ "package.json": "{}" });
    try {
      const result = await scanProject(root);
      expect(result.nodeModulesInstalled).toBe(false);
      expect(result.diagnostics.some((d) => d.id === "project.node-modules")).toBe(false);
    } finally {
      await removeFixture(root);
    }
  });

  it("reports a critical error when the directory does not exist", async () => {
    const missing = await makeFixture({});
    await removeFixture(missing);
    const result = await scanProject(missing);
    expect(result.diagnostics.some((d) => d.id === "project.directory-missing" && d.severity === "critical")).toBe(true);
  });

  it("warns when dependencies are declared but node_modules is missing", async () => {
    const root = await makeFixture({
      "package.json": JSON.stringify({ dependencies: { react: "^18.0.0" } }),
      "package-lock.json": "{}",
    });
    try {
      const result = await scanProject(root);
      const warn = result.diagnostics.find((d) => d.id === "dependencies.node-modules-missing");
      expect(warn?.severity).toBe("warning");
    } finally {
      await removeFixture(root);
    }
  });

  it("warns when the npm lock file is out of sync with package.json", async () => {
    const root = await makeFixture({
      "package.json": JSON.stringify({ dependencies: { react: "^18.0.0" } }),
      "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/other": { version: "1.0.0" } } }),
      "node_modules": "dir",
    });
    try {
      const result = await scanProject(root);
      const outOfSync = result.diagnostics.find((d) => d.id === "dependencies.lock-out-of-sync");
      expect(outOfSync?.severity).toBe("warning");
      expect(outOfSync?.message).toContain("react (missing)");
    } finally {
      await removeFixture(root);
    }
  });

  it("skips npm lock sync checks for non-npm projects", async () => {
    const root = await makeFixture({
      "package.json": JSON.stringify({ dependencies: { react: "^18.0.0" } }),
      "yarn.lock": "",
      "node_modules": "dir",
    });
    try {
      const result = await scanProject(root);
      expect(result.diagnostics.some((d) => d.id === "dependencies.lock-out-of-sync")).toBe(false);
      expect(result.packageManager.manager).toBe("yarn");
    } finally {
      await removeFixture(root);
    }
  });

  it("warns about missing env keys and unignored .env without leaking values", async () => {
    const root = await makeFixture({
      ".env": "API_KEY=hunter2\n",
      ".env.example": "API_KEY=\nDATABASE_URL=\n",
    });
    try {
      const result = await scanProject(root);
      const keysMissing = result.diagnostics.find((d) => d.id === "env.keys-missing");
      expect(keysMissing?.severity).toBe("warning");
      expect(keysMissing?.message).toContain("DATABASE_URL");
      expect(result.diagnostics.some((d) => d.id === "env.not-gitignored")).toBe(true);
      const allText = JSON.stringify(result);
      expect(allText).not.toContain("hunter2");
    } finally {
      await removeFixture(root);
    }
  });

  it("reports info when the git working tree cannot be read", async () => {
    const root = await makeFixture({ ".git": "dir", "file.txt": "hello\n" });
    try {
      const result = await scanProject(root);
      expect(result.diagnostics.some((d) => d.id === "git.unavailable" && d.severity === "info")).toBe(true);
    } finally {
      await removeFixture(root);
    }
  });

  it("flags imported packages that are not declared", async () => {
    const root = await makeFixture({
      "package.json": JSON.stringify({ dependencies: { react: "^18.0.0" } }),
      "src/index.ts": 'import axios from "axios";\nimport React from "react";\n',
    });
    try {
      const result = await scanProject(root);
      const missing = result.diagnostics.find((d) => d.id === "dependencies.imported-not-declared");
      expect(missing?.severity).toBe("warning");
      expect(missing?.message).toContain("axios");
      expect(missing?.message).not.toContain("react");
    } finally {
      await removeFixture(root);
    }
  });
});