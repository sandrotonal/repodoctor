import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitState {
  isRepo: boolean;
  branch: string | null;
  dirty: boolean;
  untracked: number;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function samePath(a: string, b: string): boolean {
  return normalizePath(a) === normalizePath(b);
}

export async function readGitState(root: string): Promise<GitState | null> {
  try {
    const projectRoot = resolve(root);
    const { stdout: toplevel } = await execFileAsync("git", ["-C", root, "rev-parse", "--show-toplevel"], { timeout: 3000 });
    if (!samePath(toplevel.trim(), projectRoot)) {
      return null;
    }

    const [{ stdout: branch }, { stdout: status }] = await Promise.all([
      execFileAsync("git", ["-C", root, "branch", "--show-current"], { timeout: 3000 }),
      execFileAsync("git", ["-C", root, "status", "--porcelain"], { timeout: 3000 }),
    ]);
    const lines = status.trim().length > 0 ? status.trim().split(/[\r\n]+/) : [];
    return {
      isRepo: true,
      branch: branch.trim() || null,
      dirty: status.trim().length > 0,
      untracked: lines.filter((line) => /^\?\?/.test(line)).length,
    };
  } catch {
    return null;
  }
}