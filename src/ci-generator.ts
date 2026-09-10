import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PackageManager } from "./core/types.js";
import { detectPackageManager } from "./detectors/package-manager.js";

export interface CiInstallResult {
  success: boolean;
  message: string;
  workflowPath?: string;
}

export interface CiInstallOptions {
  force?: boolean;
  packageManager?: PackageManager | "auto";
}

export function generateWorkflowContent(pm: PackageManager): string {
  let setupSteps = "";
  let runCommand = "";

  switch (pm) {
    case "pnpm":
      setupSteps = `      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm`;
      runCommand = "pnpm dlx @gucluyumhe/repodoctor --ci --sarif repodoctor.sarif";
      break;

    case "yarn":
      setupSteps = `      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: yarn`;
      runCommand = "yarn dlx @gucluyumhe/repodoctor --ci --sarif repodoctor.sarif";
      break;

    case "bun":
      setupSteps = `      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest`;
      runCommand = "bunx @gucluyumhe/repodoctor --ci --sarif repodoctor.sarif";
      break;

    case "npm":
    default:
      setupSteps = `      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm`;
      runCommand = "npx --yes @gucluyumhe/repodoctor --ci --sarif repodoctor.sarif";
      break;
  }

  return `name: RepoDoctor Health & Security Scan

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

${setupSteps}

      - name: Run RepoDoctor Diagnostic Scan
        run: ${runCommand}

      - name: Upload Security SARIF to GitHub Code Scanning
        uses: github/codeql-action/upload-sarif@v3
        if: always() && hashFiles('repodoctor.sarif') != ''
        with:
          sarif_file: repodoctor.sarif
`;
}

export async function installCiWorkflow(
  root: string = process.cwd(),
  options: CiInstallOptions = {},
): Promise<CiInstallResult> {
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

    let pm: PackageManager = "npm";
    if (options.packageManager && options.packageManager !== "auto") {
      pm = options.packageManager;
    } else {
      const detected = await detectPackageManager(root);
      if (detected.manager) {
        pm = detected.manager;
      }
    }

    const workflowContent = generateWorkflowContent(pm);

    await mkdir(workflowsDir, { recursive: true });
    await writeFile(targetFile, workflowContent, "utf8");

    return {
      success: true,
      message: `Successfully generated GitHub Actions workflow (${pm}) at .github/workflows/repodoctor.yml`,
      workflowPath: targetFile,
    };
  } catch {
    return {
      success: false,
      message: "Failed to create .github/workflows/repodoctor.yml. Check folder permissions.",
    };
  }
}
