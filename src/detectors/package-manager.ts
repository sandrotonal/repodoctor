import { stat } from "node:fs/promises";
import path from "node:path";
import type { PackageManager, PackageManagerDetection } from "../core/types.js";

const LOCK_FILES: ReadonlyArray<{ file: string; manager: PackageManager }> = [
  { file: "package-lock.json", manager: "npm" },
  { file: "yarn.lock", manager: "yarn" },
  { file: "pnpm-lock.yaml", manager: "pnpm" },
  { file: "bun.lock", manager: "bun" },
  { file: "bun.lockb", manager: "bun" },
];

export async function detectPackageManager(root: string): Promise<PackageManagerDetection> {
  const hits = (
    await Promise.all(
      LOCK_FILES.map(async ({ file, manager }) => {
        try {
          await stat(path.join(root, file));
          return { file, manager };
        } catch {
          return null;
        }
      }),
    )
  ).filter((hit): hit is { file: string; manager: PackageManager } => hit !== null);

  if (hits.length === 0) {
    return { manager: null, lockFiles: [], ambiguous: false };
  }

  const managers = new Set(hits.map((hit) => hit.manager));
  return {
    manager: managers.size === 1 ? hits[0].manager : null,
    lockFiles: hits.map((hit) => hit.file),
    ambiguous: managers.size > 1,
  };
}