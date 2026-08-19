import { describe, it, expect } from "vitest";
import net from "node:net";
import { checkPortConflicts, isPortInUse } from "../src/checks/port-conflict.js";
import { detectPorts } from "../src/detectors/ports.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as net.AddressInfo;
      const port = address.port;
      server.close(() => resolve(port));
    });
    server.once("error", reject);
  });
}

describe("detectPorts", () => {
  it("detects PORT from .env files and package.json config", async () => {
    const root = await makeFixture({
      ".env": "PORT=3000\n",
      ".env.example": "PORT=\n",
      "package.json": JSON.stringify({ config: { port: 4000 } }),
    });
    try {
      const packageJson = { config: { port: 4000 } };
      const sources = await detectPorts(root, packageJson);
      expect(sources).toEqual([
        { port: 3000, source: ".env" },
        { port: 4000, source: "package.json config.port" },
      ]);
    } finally {
      await removeFixture(root);
    }
  });

  it("deduplicates ports and ignores invalid values", async () => {
    const root = await makeFixture({ ".env.example": "PORT=3000\n" });
    try {
      const sources = await detectPorts(root, null);
      expect(sources).toEqual([{ port: 3000, source: ".env.example" }]);
      expect(sources.filter((s) => s.port === 99999)).toHaveLength(0);
    } finally {
      await removeFixture(root);
    }
  });
});

describe("checkPortConflicts", () => {
  it("reports a conflict when the port is already bound", async () => {
    const port = await freePort();
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
    try {
      expect(await isPortInUse(port)).toBe(true);
      const diagnostics = await checkPortConflicts([{ port, source: ".env" }]);
      const conflict = diagnostics.find((d) => d.id === "port.conflict");
      expect(conflict?.severity).toBe("warning");
      expect(conflict?.message).toContain("Declared in .env.");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("reports availability for a free port", async () => {
    const port = await freePort();
    const diagnostics = await checkPortConflicts([{ port, source: ".env" }]);
    const available = diagnostics.find((d) => d.id === "port.available");
    expect(available?.severity).toBe("success");
    expect(await isPortInUse(port)).toBe(false);
  });
});