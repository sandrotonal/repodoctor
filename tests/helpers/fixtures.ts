import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type FixtureEntry = string | "dir";

export async function makeFixture(files: Record<string, FixtureEntry>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "repodoctor-test-"));
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(root, name);
    if (content === "dir") {
      await mkdir(full, { recursive: true });
    } else {
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, content);
    }
  }
  return root;
}

export async function removeFixture(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}