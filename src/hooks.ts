import { chmod, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface HookInstallResult {
  success: boolean;
  message: string;
  hookPath?: string;
}

const PRE_COMMIT_SCRIPT = `#!/bin/sh
# RepoDoctor Pre-commit Hook - Protect against secret leaks & misconfigurations
echo "[RepoDoctor] Running pre-commit diagnostic checks..."
npx @gucluyumhe/repodoctor --ci
STATUS=$?
if [ $STATUS -ne 0 ]; then
  echo ""
  echo "[RepoDoctor] Commit blocked: Critical issues or leaked secrets detected."
  echo "Run 'npx @gucluyumhe/repodoctor' to review or '--fix' to automatically resolve issues."
  echo ""
  exit 1
fi
exit 0
`;

export async function installPreCommitHook(root: string = process.cwd()): Promise<HookInstallResult> {
  const gitDir = path.join(root, ".git");

  try {
    const s = await stat(gitDir);
    if (!s.isDirectory()) {
      return { success: false, message: "Directory .git is not a valid git repository folder." };
    }
  } catch {
    return { success: false, message: "Not a git repository. Run 'git init' before installing the pre-commit hook." };
  }

  const hooksDir = path.join(gitDir, "hooks");
  await mkdir(hooksDir, { recursive: true });

  const hookFile = path.join(hooksDir, "pre-commit");
  await writeFile(hookFile, PRE_COMMIT_SCRIPT, "utf8");

  try {
    await chmod(hookFile, 0o755);
  } catch {
    // Windows might not support chmod 755 directly, which is fine
  }

  return {
    success: true,
    message: "RepoDoctor pre-commit hook successfully installed.",
    hookPath: hookFile,
  };
}
