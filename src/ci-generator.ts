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
  pinActions?: boolean;
}

export const PINNED_ACTIONS: Record<string, { sha: string; versionComment: string }> = {
  "actions/checkout@v4": {
    sha: "b4ffde65f46336ab88eb53be808477a3936bae11",
    versionComment: "# v4.1.1",
  },
  "actions/setup-node@v4": {
    sha: "60edb5dd545a775178f52524783378180af0d1f8",
    versionComment: "# v4.0.2",
  },
  "github/codeql-action/upload-sarif@v3": {
    sha: "4f3212b61783c3c68e8309a0f18a699764811cda",
    versionComment: "# v3.26.2",
  },
  "pnpm/action-setup@v3": {
    sha: "fe02b34f77f8bc70b72253e3436062835fa17884",
    versionComment: "# v3.0.0",
  },
  "oven-sh/setup-bun@v2": {
    sha: "4bc047ad259df6fc24a6c9b0f9a0cb08cf17fbe5",
    versionComment: "# v2.0.1",
  },
};

export function resolveActionRef(actionTag: string, pinActions: boolean = false): string {
  if (!pinActions) return actionTag;
  const match = PINNED_ACTIONS[actionTag];
  if (!match) return actionTag;
  const baseName = actionTag.split("@")[0]!;
  return `${baseName}@${match.sha} ${match.versionComment}`;
}

export function generateWorkflowContent(pm: PackageManager, pinActions: boolean = false): string {
  let setupSteps = "";
  let runCommand = "";

  const checkoutAction = resolveActionRef("actions/checkout@v4", pinActions);
  const setupNodeAction = resolveActionRef("actions/setup-node@v4", pinActions);
  const uploadSarifAction = resolveActionRef("github/codeql-action/upload-sarif@v3", pinActions);
  const pnpmSetupAction = resolveActionRef("pnpm/action-setup@v3", pinActions);
  const bunSetupAction = resolveActionRef("oven-sh/setup-bun@v2", pinActions);

  switch (pm) {
    case "pnpm":
      setupSteps = `      - name: Setup pnpm
        uses: ${pnpmSetupAction}
        with:
          version: 9

      - name: Setup Node.js
        uses: ${setupNodeAction}
        with:
          node-version: 20
          cache: pnpm`;
      runCommand = "pnpm dlx @gucluyumhe/repodoctor --ci --sarif repodoctor.sarif";
      break;

    case "yarn":
      setupSteps = `      - name: Setup Node.js
        uses: ${setupNodeAction}
        with:
          node-version: 20
          cache: yarn`;
      runCommand = "yarn dlx @gucluyumhe/repodoctor --ci --sarif repodoctor.sarif";
      break;

    case "bun":
      setupSteps = `      - name: Setup Bun
        uses: ${bunSetupAction}
        with:
          bun-version: latest`;
      runCommand = "bunx @gucluyumhe/repodoctor --ci --sarif repodoctor.sarif";
      break;

    case "npm":
    default:
      setupSteps = `      - name: Setup Node.js
        uses: ${setupNodeAction}
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
        uses: ${checkoutAction}

${setupSteps}

      - name: Run RepoDoctor Diagnostic Scan
        run: ${runCommand}

      - name: Upload Security SARIF to GitHub Code Scanning
        uses: ${uploadSarifAction}
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

    const workflowContent = generateWorkflowContent(pm, options.pinActions ?? false);

    await mkdir(workflowsDir, { recursive: true });
    await writeFile(targetFile, workflowContent, "utf8");

    return {
      success: true,
      message: `Successfully generated GitHub Actions workflow (${pm}${options.pinActions ? ", pinned actions" : ""}) at .github/workflows/repodoctor.yml`,
      workflowPath: targetFile,
    };
  } catch {
    return {
      success: false,
      message: "Failed to create .github/workflows/repodoctor.yml. Check folder permissions.",
    };
  }
}
