import net from "node:net";
import type { Diagnostic } from "../core/types.js";
import type { PortSource } from "../detectors/ports.js";

export function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => server.close(() => resolve(false)));
    server.listen(port, "127.0.0.1");
  });
}

export async function checkPortConflicts(sources: PortSource[]): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];

  for (const { port, source } of sources) {
    const inUse = await isPortInUse(port);
    diagnostics.push(
      inUse
        ? {
            id: "port.conflict",
            severity: "warning",
            title: `Port ${port} is already in use`,
            message: `Declared in ${source}.`,
            recommendation: "Stop the process using this port or change the configured port.",
          }
        : {
            id: "port.available",
            severity: "success",
            title: `Port ${port} is available`,
            message: `Declared in ${source}.`,
          },
    );
  }

  return diagnostics;
}