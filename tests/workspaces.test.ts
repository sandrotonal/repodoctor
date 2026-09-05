import { describe, expect, it } from "vitest";
import { detectWorkspaces } from "../src/detectors/workspaces.js";
import { checkWorkspaces } from "../src/checks/workspaces.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

describe("Monorepo & Workspaces Detector", () => {
  it("detects pnpm monorepo and version drift across packages", async () => {
    const fixture = await makeFixture({
      "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
      "packages/ui/package.json": JSON.stringify({
        name: "@repo/ui",
        dependencies: { lodash: "^4.17.21" },
      }),
      "packages/web/package.json": JSON.stringify({
        name: "@repo/web",
        dependencies: { lodash: "^3.10.1" },
      }),
    });

    try {
      const scan = await detectWorkspaces(fixture, null);
      expect(scan.isMonorepo).toBe(true);
      expect(scan.tool).toBe("pnpm");
      expect(scan.packages.length).toBe(2);
      expect(scan.versionDrifts.length).toBe(1);
      expect(scan.versionDrifts[0]?.packageName).toBe("lodash");

      const diags = checkWorkspaces(scan);
      expect(diags.some((d) => d.id.includes("version-drift:lodash"))).toBe(true);
    } finally {
      await removeFixture(fixture);
    }
  });

  it("returns non-monorepo for standard single repos", async () => {
    const fixture = await makeFixture({
      "package.json": JSON.stringify({ name: "my-app" }),
    });

    try {
      const scan = await detectWorkspaces(fixture, { name: "my-app" });
      expect(scan.isMonorepo).toBe(false);
      expect(scan.packages.length).toBe(0);

      const diags = checkWorkspaces(scan);
      expect(diags.length).toBe(0);
    } finally {
      await removeFixture(fixture);
    }
  });
});
