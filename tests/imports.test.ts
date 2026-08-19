import { describe, it, expect } from "vitest";
import { packageNameFromSpecifier, scanImports } from "../src/detectors/imports.js";
import { checkDependencyUsage } from "../src/checks/dependency-usage.js";
import type { ImportScan } from "../src/detectors/imports.js";
import type { PackageJsonData } from "../src/core/types.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

describe("packageNameFromSpecifier", () => {
  it("extracts the package name from bare specifiers", () => {
    expect(packageNameFromSpecifier("react")).toBe("react");
    expect(packageNameFromSpecifier("lodash/fp")).toBe("lodash");
    expect(packageNameFromSpecifier("@scope/pkg")).toBe("@scope/pkg");
    expect(packageNameFromSpecifier("@scope/pkg/sub")).toBe("@scope/pkg");
  });

  it("returns null for relative, builtin and alias specifiers", () => {
    expect(packageNameFromSpecifier("./utils")).toBeNull();
    expect(packageNameFromSpecifier("../x")).toBeNull();
    expect(packageNameFromSpecifier("node:fs")).toBeNull();
    expect(packageNameFromSpecifier("#imports")).toBeNull();
    expect(packageNameFromSpecifier("~/lib")).toBeNull();
  });
});

describe("scanImports", () => {
  it("collects packages from imports, requires and dynamic imports", async () => {
    const root = await makeFixture({
      "src/index.ts": `import express from "express";\nimport { readFileSync } from "fs";\nexport { config } from "./config";\nconst db = require("lodash").head;\n`,
      "src/feature.ts": "const mod = await import(\"@scope/pkg/theme\");\n",
      "node_modules/dummy.ts": "import \"should-skip\";\n",
    });
    try {
      const result = await scanImports(root);
      expect(result.packagesImported.has("express")).toBe(true);
      expect(result.packagesImported.has("lodash")).toBe(true);
      expect(result.packagesImported.has("@scope/pkg")).toBe(true);
      expect(result.packagesImported.has("fs")).toBe(true);
      expect(result.packagesImported.has("./config")).toBe(false);
      expect(result.packagesImported.has("should-skip")).toBe(false);
    } finally {
      await removeFixture(root);
    }
  });

  it("ignores node_modules and build output directories", async () => {
    const root = await makeFixture({
      "src/app.ts": 'import "real-dep";\n',
      "dist/bundle.ts": 'import "fake-dep";\n',
    });
    try {
      const result = await scanImports(root);
      expect(result.packagesImported.has("real-dep")).toBe(true);
      expect(result.packagesImported.has("fake-dep")).toBe(false);
    } finally {
      await removeFixture(root);
    }
  });
});

const noImports: ImportScan = { packagesUsed: new Set(), packagesImported: new Set() };

describe("checkDependencyUsage", () => {
  it("warns about declared dependencies never referenced", () => {
    const data: PackageJsonData = { dependencies: { react: "^18.0.0" }, devDependencies: { typescript: "^5.0.0" } };
    const diagnostics = checkDependencyUsage({ data, imports: noImports });
    const unused = diagnostics.find((d) => d.id === "dependencies.unused");
    expect(unused?.severity).toBe("warning");
    expect(unused?.message).toContain("react");
    expect(unused?.message).toContain("typescript");
  });

  it("considers packages used in scripts as referenced", () => {
    const data: PackageJsonData = {
      devDependencies: { eslint: "^9.0.0" },
      scripts: { start: "node src/index.js", lint: "eslint ." },
    };
    const diagnostics = checkDependencyUsage({ data, imports: noImports });
    const unused = diagnostics.find((d) => d.id === "dependencies.unused");
    expect(unused).toBeUndefined();
  });

  it("matches CLI binaries in scripts (tsc → typescript)", () => {
    const data: PackageJsonData = {
      devDependencies: { typescript: "^5.0.0" },
      scripts: { typecheck: "tsc --noEmit" },
    };
    const diagnostics = checkDependencyUsage({ data, imports: noImports });
    const unused = diagnostics.find((d) => d.id === "dependencies.unused");
    expect(unused).toBeUndefined();
  });

  it("ignores @types packages from unused warnings", () => {
    const data: PackageJsonData = { devDependencies: { "@types/node": "^22.0.0" } };
    const diagnostics = checkDependencyUsage({ data, imports: noImports });
    expect(diagnostics.some((d) => d.id === "dependencies.unused")).toBe(false);
  });

  it("warns about imported packages missing from package.json", () => {
    const data: PackageJsonData = { dependencies: { react: "^18.0.0" } };
    const diagnostics = checkDependencyUsage({
      data,
      imports: { packagesUsed: new Set(["react", "axios"]), packagesImported: new Set(["react", "axios"]) },
    });
    const missing = diagnostics.find((d) => d.id === "dependencies.imported-not-declared");
    expect(missing?.severity).toBe("warning");
    expect(missing?.message).toContain("axios");
    expect(missing?.message).not.toContain("react");
  });

  it("does not flag node builtins as missing", () => {
    const data: PackageJsonData = {};
    const diagnostics = checkDependencyUsage({
      data,
      imports: { packagesUsed: new Set(["fs", "node:path"]), packagesImported: new Set(["fs", "node:path"]) },
    });
    expect(diagnostics.some((d) => d.id === "dependencies.imported-not-declared")).toBe(false);
  });

  it("returns no diagnostics for a clean project", () => {
    const data: PackageJsonData = { dependencies: { react: "^18.0.0" } };
    const diagnostics = checkDependencyUsage({
      data,
      imports: { packagesUsed: new Set(["react"]), packagesImported: new Set(["react"]) },
    });
    expect(diagnostics).toEqual([]);
  });
});