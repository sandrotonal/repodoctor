import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export interface CiWorkflowIssue {
  file: string;
  line: number;
  message: string;
  recommendation: string;
  severity: "warning" | "info";
}

export interface CiScanResult {
  hasCi: boolean;
  workflowFiles: string[];
  hasRepoDoctorCi: boolean;
  issues: CiWorkflowIssue[];
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const s = await stat(dirPath);
    return s.isDirectory();
  } catch {
    return false;
  }
}

export async function detectCiWorkflows(root: string): Promise<CiScanResult> {
  const workflowsDir = path.join(root, ".github", "workflows");
  if (!(await dirExists(workflowsDir))) {
    return {
      hasCi: false,
      workflowFiles: [],
      hasRepoDoctorCi: false,
      issues: [],
    };
  }

  let entries: string[] = [];
  try {
    entries = await readdir(workflowsDir);
  } catch {
    return {
      hasCi: false,
      workflowFiles: [],
      hasRepoDoctorCi: false,
      issues: [],
    };
  }

  const workflowFiles = entries.filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
  if (workflowFiles.length === 0) {
    return {
      hasCi: false,
      workflowFiles: [],
      hasRepoDoctorCi: false,
      issues: [],
    };
  }

  let hasRepoDoctorCi = false;
  const issues: CiWorkflowIssue[] = [];

  for (const fileName of workflowFiles) {
    const filePath = path.join(workflowsDir, fileName);
    let text = "";
    try {
      text = await readFile(filePath, "utf8");
    } catch {
      continue;
    }

    if (text.includes("repodoctor")) {
      hasRepoDoctorCi = true;
    }

    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // Check outdated actions/checkout or setup-node
      if (/uses:\s*actions\/checkout@(v1|v2|v3)\b/i.test(line)) {
        issues.push({
          file: `.github/workflows/${fileName}`,
          line: i + 1,
          message: `Uses outdated '${line.trim()}'. GitHub has deprecated Node.js 16/12 actions.`,
          recommendation: "Upgrade to 'actions/checkout@v4'.",
          severity: "warning",
        });
      }

      if (/uses:\s*actions\/setup-node@(v1|v2|v3)\b/i.test(line)) {
        issues.push({
          file: `.github/workflows/${fileName}`,
          line: i + 1,
          message: `Uses outdated '${line.trim()}'.`,
          recommendation: "Upgrade to 'actions/setup-node@v4'.",
          severity: "warning",
        });
      }

      // Check mutable master/main tag
      if (/uses:\s*[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+@(master|main)\b/i.test(line)) {
        issues.push({
          file: `.github/workflows/${fileName}`,
          line: i + 1,
          message: `Action references mutable '${line.trim()}'.`,
          recommendation: "Pin action to a specific release tag (e.g. @v4) or full commit SHA for supply-chain security.",
          severity: "warning",
        });
      }
    }
  }

  return {
    hasCi: true,
    workflowFiles,
    hasRepoDoctorCi,
    issues,
  };
}
