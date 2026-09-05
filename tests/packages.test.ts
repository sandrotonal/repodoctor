import { describe, expect, it } from "vitest";
import { checkPackageSupplyChain } from "../src/detectors/packages.js";
import { checkPackages } from "../src/checks/packages.js";

describe("Package Supply Chain & Deprecation Detector", () => {
  it("detects deprecated packages and suggests replacements", () => {
    const pkg = {
      dependencies: {
        request: "^2.88.2",
        tslint: "^6.1.3",
      },
    };

    const result = checkPackageSupplyChain(pkg);
    expect(result.deprecated.length).toBe(2);
    expect(result.deprecated.some((d) => d.name === "request")).toBe(true);

    const diags = checkPackages(result);
    const requestDiag = diags.find((d) => d.id.includes("deprecated:request"));
    expect(requestDiag).toBeDefined();
    expect(requestDiag?.severity).toBe("warning");
    expect(requestDiag?.recommendation).toContain("fetch, axios, or got");
  });

  it("detects typosquatted packages as critical", () => {
    const pkg = {
      dependencies: {
        "cross-env.js": "^7.0.3",
        loadsh: "^4.17.21",
      },
    };

    const result = checkPackageSupplyChain(pkg);
    expect(result.typosquats.length).toBe(2);

    const diags = checkPackages(result);
    expect(diags.every((d) => d.severity === "critical")).toBe(true);
  });

  it("warns about missing license", () => {
    const pkg = {
      name: "my-custom-lib",
    };

    const result = checkPackageSupplyChain(pkg);
    expect(result.missingLicense).toBe(true);

    const diags = checkPackages(result);
    expect(diags.some((d) => d.id === "packages.license-missing")).toBe(true);
  });
});
