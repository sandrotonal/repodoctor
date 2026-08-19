import type { ScanResult } from "../core/types.js";

export function renderJson(result: ScanResult): void {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}