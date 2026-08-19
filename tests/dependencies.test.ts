import { describe, it, expect } from "vitest";
import { checkDependencies } from "../src/checks/dependencies.js";
import { readNpmLock } from "../src/detectors/lock-file.js";
import type { NpmLockResult } from "../src/detectors/lock-file.js";
import type { PackageManagerDetection } from "../src/core/types.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

const npmManager: PackageManagerDetection = { manager: "npm", lockFiles: ["package-lock.json"], ambiguous: false };
const noLock: PackageManagerDetection = { manager: null, lockFiles: [], ambiguous: false };

const emptyNpmLock: NpmLockResult = {
  exists: true,
  parseError: null,
  content: { lockfileVersion: 3, rootDependencies: {}, installedNames: new Set() },
};

describe("readNpmLock", () => {
  it("extracts installed names from a v2/v3 package-lock.json", async () => {
    const lock = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": { dependencies: { react: "^18.0.0" }, devDependencies: { typescript: "^5.0.0" } },
        "node_modules/react": { version: "18.2.0" },
        "node_modules/typescript": { version: "5.7.2" },
      },
    });
    const root = await makeFixture({ "package-lock.json": lock });
    try {
      const result = await readNpmLock(root);
      expect(result.exists).toBe(true);
      expect(result.parseError).toBeNull();
      expect(result.content?.installedNames.has("react")).toBe(true);
      expect(result.content?.installedNames.has("typescript")).toBe(true);
      expect(result.content?.installedNames.has("missing")).toBe(false);
      expect(result.content?.rootDependencies.react).toBe("^18.0.0");
    } finally {
      await removeFixture(root);
    }
  });

  it("extracts installed names from a v1 package-lock.json", async () => {
    const lock = JSON.stringify({
      lockfileVersion: 1,
      dependencies: {
        react: { version: "18.2.0" },
        "react-dom": { version: "18.2.0", dependencies: { scheduler: { version: "0.23.0" } } },
      },
    });
    const root = await makeFixture({ "package-lock.json": lock });
    try {
      const result = await readNpmLock(root);
      expect(result.content?.installedNames.has("react")).toBe(true);
      expect(result.content?.installedNames.has("react-dom")).toBe(true);
    } finally {
      await removeFixture(root);
    }
  });

  it("reports a parse error for invalid JSON", async () => {
    const root = await makeFixture({ "package-lock.json": "{ not valid json" });
    try {
      const result = await readNpmLock(root);
      expect(result.exists).toBe(true);
      expect(result.content).toBeNull();
      expect(result.parseError).not.toBeNull();
    } finally {
      await removeFixture(root);
    }
  });

  it("reports missing package-lock.json", async () => {
    const root = await makeFixture({});
    try {
      const result = await readNpmLock(root);
      expect(result.exists).toBe(false);
      expect(result.content).toBeNull();
    } finally {
      await removeFixture(root);
    }
  });
});

describe("checkDependencies", () => {
  const data = { dependencies: { react: "^18.0.0" }, devDependencies: { typescript: "^5.0.0" } };

  it("warns when node_modules is missing", () => {
    const diagnostics = checkDependencies({ data, nodeModulesInstalled: false, packageManager: npmManager, npmLock: emptyNpmLock });
    const warn = diagnostics.find((d) => d.id === "dependencies.node-modules-missing");
    expect(warn?.severity).toBe("warning");
    expect(warn?.message).toContain("2 dependencies");
  });

  it("warns when no lock file exists", () => {
    const diagnostics = checkDependencies({ data, nodeModulesInstalled: true, packageManager: noLock, npmLock: null });
    expect(diagnostics.some((d) => d.id === "dependencies.lock-file-missing" && d.severity === "warning")).toBe(true);
  });

  it("reports no diagnostics when the npm lock is in sync", () => {
    const inSync: NpmLockResult = {
      exists: true,
      parseError: null,
      content: { lockfileVersion: 3, rootDependencies: { react: "^18.0.0", typescript: "^5.0.0" }, installedNames: new Set(["react", "typescript"]) },
    };
    const diagnostics = checkDependencies({ data, nodeModulesInstalled: true, packageManager: npmManager, npmLock: inSync });
    expect(diagnostics.some((d) => d.id === "dependencies.lock-out-of-sync")).toBe(false);
  });

  it("warns when a declared dependency is missing from the lock file", () => {
    const diagnostics = checkDependencies({ data, nodeModulesInstalled: true, packageManager: npmManager, npmLock: emptyNpmLock });
    const outOfSync = diagnostics.find((d) => d.id === "dependencies.lock-out-of-sync");
    expect(outOfSync?.severity).toBe("warning");
    expect(outOfSync?.message).toContain("react (missing)");
    expect(outOfSync?.message).toContain("typescript (missing)");
  });

  it("warns when a dependency version spec changed in package.json", () => {
    const lock: NpmLockResult = {
      exists: true,
      parseError: null,
      content: { lockfileVersion: 3, rootDependencies: { react: "^18.0.0", typescript: "^5.0.0" }, installedNames: new Set(["react", "typescript"]) },
    };
    const changedData = { dependencies: { react: "^19.0.0" }, devDependencies: { typescript: "^5.0.0" } };
    const diagnostics = checkDependencies({ data: changedData, nodeModulesInstalled: true, packageManager: npmManager, npmLock: lock });
    const outOfSync = diagnostics.find((d) => d.id === "dependencies.lock-out-of-sync");
    expect(outOfSync?.message).toContain("react (spec changed)");
    expect(outOfSync?.message).not.toContain("typescript (spec changed)");
  });

  it("warns for an unparseable package-lock.json", () => {
    const invalid: NpmLockResult = { exists: true, parseError: "invalid JSON", content: null };
    const diagnostics = checkDependencies({ data, nodeModulesInstalled: true, packageManager: npmManager, npmLock: invalid });
    expect(diagnostics.some((d) => d.id === "dependencies.lock-invalid" && d.severity === "warning")).toBe(true);
  });

  it("returns no diagnostics when no dependencies are declared", () => {
    const diagnostics = checkDependencies({ data: {}, nodeModulesInstalled: false, packageManager: noLock, npmLock: null });
    expect(diagnostics).toEqual([]);
  });
});