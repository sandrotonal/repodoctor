import { describe, it, expect } from "vitest";
import { readPackageJson } from "../src/detectors/package-json.js";
import { checkPackageJson } from "../src/checks/package-json.js";
import type { PackageManagerDetection } from "../src/core/types.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

const npmManager: PackageManagerDetection = { manager: "npm", lockFiles: ["package-lock.json"], ambiguous: false };

describe("readPackageJson", () => {
  it("reads and parses a valid package.json", async () => {
    const root = await makeFixture({ "package.json": JSON.stringify({ name: "demo", version: "1.0.0" }) });
    try {
      const result = await readPackageJson(root);
      expect(result.exists).toBe(true);
      expect(result.parseError).toBeNull();
      expect(result.content?.name).toBe("demo");
    } finally {
      await removeFixture(root);
    }
  });

  it("reports a parse error for invalid JSON", async () => {
    const root = await makeFixture({ "package.json": "{ not valid json" });
    try {
      const result = await readPackageJson(root);
      expect(result.exists).toBe(true);
      expect(result.content).toBeNull();
      expect(result.parseError).not.toBeNull();
    } finally {
      await removeFixture(root);
    }
  });

  it("reports missing package.json", async () => {
    const root = await makeFixture({});
    try {
      const result = await readPackageJson(root);
      expect(result.exists).toBe(false);
      expect(result.content).toBeNull();
      expect(result.parseError).toBeNull();
    } finally {
      await removeFixture(root);
    }
  });
});

describe("checkPackageJson", () => {
  it("reports invalid package.json as critical", () => {
    const diagnostics = checkPackageJson(null, "invalid JSON", npmManager);
    const invalid = diagnostics.find((d) => d.id === "package-json.invalid");
    expect(invalid?.severity).toBe("critical");
  });

  it("reports valid package.json and declared scripts/dependencies", () => {
    const data = {
      scripts: { dev: "vite", build: "vite build" },
      dependencies: { react: "^18.0.0" },
      devDependencies: { typescript: "^5.0.0" },
    };
    const diagnostics = checkPackageJson(data, null, npmManager);

    expect(diagnostics.find((d) => d.id === "package-json.valid")?.severity).toBe("success");
    expect(diagnostics.find((d) => d.id === "package-json.scripts")?.message).toBe("dev, build");
    expect(diagnostics.find((d) => d.id === "package-json.dependencies")?.message).toBe("1 dependencies, 1 devDependencies");
  });

  it("reports engines.node declaration", () => {
    const data = { engines: { node: ">=20" } };
    const diagnostics = checkPackageJson(data, null, npmManager);
    expect(diagnostics.find((d) => d.id === "package-json.engines")?.message).toBe("node >=20");
  });

  it("reports a warning when packageManager field conflicts with lock file", () => {
    const data = { packageManager: "pnpm@9.0.0" };
    const diagnostics = checkPackageJson(data, null, npmManager);
    const mismatch = diagnostics.find((d) => d.id === "package-manager.mismatch");
    expect(mismatch?.severity).toBe("warning");
    expect(mismatch?.message).toContain("pnpm");
  });

  it("does not warn when packageManager field matches the lock file", () => {
    const data = { packageManager: "npm@10.0.0" };
    const diagnostics = checkPackageJson(data, null, npmManager);
    expect(diagnostics.some((d) => d.id === "package-manager.mismatch")).toBe(false);
  });
});