import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface CiInstallResult {
  success: boolean;
  message: string;
  workflowPath?: string;
}

export interface CiInstallOptions {
  force?: boolean;
}

const REPO_DOCTOR_WORKFLOW = `name: RepoDoctor Health & Security Scan

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  repodoctor:
    name: RepoDoctor Health & Security Scan
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Run RepoDoctor Diagnostic Scan
        run: npx @gucluyumhe/repodoctor --ci --sarif repodoctor.sarif

      - name: Upload Security SARIF to GitHub Code Scanning
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: repodoctor.sarif
`;

export async function installCiWorkflow(root: string = process.cwd(), options: CiInstallOptions = {}): Promise<CiInstallResult> {
  const workflowsDir = path.join(root, ".github", "workflows");

  try {
    const targetFile = path.join(workflowsDir, "repodoctor.yml");

    if (!options.force) {
      try {
        await stat(targetFile);
        return {
          success: false,
          message: "Workflow file already exists at .github/workflows/repodoctor.yml. Use --force to overwrite.",
          workflowPath: targetFile,
        };
      } catch {
        // File does not exist, proceed to create
      }
    }

    await mkdir(workflowsDir, { recursive: true });
    await writeFile(targetFile, REPO_DOCTOR_WORKFLOW, "utf8");

    return {
      success: true,
      message: "Successfully generated GitHub Actions workflow at .github/workflows/repodoctor.yml",
      workflowPath: targetFile,
    };
  } catch {
    return {
      success: false,
      message: "Failed to create .github/workflows/repodoctor.yml. Check folder permissions.",
    };
  }
}
