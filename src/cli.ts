import { Command } from "commander";
import chalk from "chalk";
import pkg from "../package.json" with { type: "json" };
import { scanProject } from "./core/scanner.js";
import { renderScan, type ScanStyle } from "./output/terminal.js";
import { renderJson } from "./output/json.js";
import { applyFixes } from "./fixes.js";
import type { ScanAnimationHandle } from "./output/animate.js";
import { createScanAnimation } from "./output/animate.js";

const { version } = pkg;

interface CliOptions {
  json: boolean;
  ci: boolean;
  fix: boolean;
  style?: string;
}

export function run(argv: string[] = process.argv): void {
  const program = new Command();

  program
    .name("repodoctor")
    .description("Diagnose your project before you waste time debugging it.")
    .version(version, "-v, --version", "output the current version")
    .argument("[dir]", "project directory to analyze", process.cwd())
    .option("--json", "output the scan result as JSON")
    .option("--ci", "machine-readable mode; exits non-zero on warnings or worse")
    .option("--fix", "attempt safe automatic fixes for the issues found")
    .option("--style <mode>", "output style: plain, panel or auto (default: auto)")
    .action(async (dir: string, options: CliOptions) => {
      try {
        const style = resolveStyle(options.style);

        let result = await scanWithAnimation(dir, style);

        if (options.fix) {
          const { applied } = await applyFixes(result.root, result.diagnostics);
          if (applied.length > 0) {
            console.error(chalk.green(`Applied ${applied.length} fix(es): ${applied.join("; ")}`));
            result = await scanWithAnimation(dir, style);
          }
        }

        if (options.json) {
          renderJson(result);
        } else {
          renderScan(result, style);
        }

        const hasCritical = result.diagnostics.some((diagnostic) => diagnostic.severity === "critical");
        const hasWarning = result.diagnostics.some((diagnostic) => diagnostic.severity === "warning");
        if (options.ci ? hasCritical || hasWarning : hasCritical) {
          process.exitCode = 1;
        }
      } catch (error) {
        console.error(chalk.red("Unable to analyze the project directory."));
        process.exitCode = 1;
      }
    });

  program.parse(argv);
}

async function scanWithAnimation(dir: string, style: ScanStyle): Promise<ReturnType<typeof scanProject>> {
  let animation: ScanAnimationHandle | null = null;
  if (style === "panel") {
    animation = createScanAnimation();
  }

  try {
    const result = await scanProject(dir, { onProgress: (label) => animation?.progress(label) });
    animation?.finish();
    return result;
  } catch (error) {
    animation?.abort();
    throw error;
  }
}

function resolveStyle(preferred?: string): ScanStyle {
  const value = (preferred ?? process.env.REPODOCTOR_STYLE ?? "auto").toLowerCase();
  if (value === "plain") {
    return "plain";
  }
  if (value === "panel") {
    return "panel";
  }
  return process.stdout.isTTY ? "panel" : "plain";
}