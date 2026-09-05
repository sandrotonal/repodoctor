import { describe, expect, it } from "vitest";
import { detectFrameworks } from "../src/detectors/frameworks.js";
import { checkFrameworks } from "../src/checks/frameworks.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

describe("Frameworks Health Detector", () => {
  it("detects Next.js client component importing server-only", async () => {
    const fixture = await makeFixture({
      "package.json": JSON.stringify({ dependencies: { next: "^14.0.0" } }),
      "src/components/Client.tsx": `
        "use client";
        import "server-only";
        export function Client() { return <div>Client</div>; }
      `,
    });

    try {
      const result = await detectFrameworks(fixture, { dependencies: { next: "^14.0.0" } });
      expect(result.frameworks).toContain("nextjs");
      expect(result.issues.length).toBeGreaterThan(0);

      const serverOnlyIssue = result.issues.find((i) => i.id.includes("server-only-in-client"));
      expect(serverOnlyIssue).toBeDefined();
      expect(serverOnlyIssue?.severity).toBe("critical");

      const diags = checkFrameworks(result);
      expect(diags.some((d) => d.severity === "critical")).toBe(true);
    } finally {
      await removeFixture(fixture);
    }
  });

  it("detects Vite project using NEXT_PUBLIC_ env prefix", async () => {
    const fixture = await makeFixture({
      "package.json": JSON.stringify({ devDependencies: { vite: "^5.0.0" } }),
      "src/api.ts": `
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      `,
    });

    try {
      const result = await detectFrameworks(fixture, { devDependencies: { vite: "^5.0.0" } });
      expect(result.frameworks).toContain("vite");

      const prefixIssue = result.issues.find((i) => i.id.includes("env.prefix-mismatch"));
      expect(prefixIssue).toBeDefined();
      expect(prefixIssue?.severity).toBe("warning");
    } finally {
      await removeFixture(fixture);
    }
  });

  it("detects Tailwind declared without tailwind.config", async () => {
    const fixture = await makeFixture({
      "package.json": JSON.stringify({ dependencies: { tailwindcss: "^3.4.0" } }),
    });

    try {
      const result = await detectFrameworks(fixture, { dependencies: { tailwindcss: "^3.4.0" } });
      expect(result.hasTailwind).toBe(true);

      const configIssue = result.issues.find((i) => i.id.includes("tailwind.missing-config"));
      expect(configIssue).toBeDefined();
    } finally {
      await removeFixture(fixture);
    }
  });
});
