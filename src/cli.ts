import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import pkg from "../package.json" with { type: "json" };
import { scanProject, type ScanOptions } from "./core/scanner.js";
import { renderScan, type ScanStyle } from "./output/terminal.js";
import { renderJson } from "./output/json.js";
import { generateHtmlReport } from "./output/html.js";
import { generateSarifReport } from "./output/sarif.js";
import { generateMarkdownReport } from "./output/markdown.js";
import { applyFixes } from "./fixes.js";
import type { ScanAnimationHandle } from "./output/animate.js";
import { createScanAnimation } from "./output/animate.js";
import { loadBaseline, saveBaseline } from "./core/baseline.js";

const { version } = pkg;

interface CliOptions {
  json: boolean;
  ci: boolean;
  fix: boolean;
  dryRun?: boolean;
  style?: string;
  html?: string;
  sarif?: string;
  markdown?: string;
  ignoreFile?: string;
  baseline?: string;
  updateBaseline?: boolean;
  newOnly?: boolean;
  maxFiles?: string;
  maxFileSize?: string;
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
    .option("--dry-run", "preview fixes as unified diffs without modifying files")
    .option("--style <mode>", "output style: plain, panel or auto (default: auto)")
    .option("--html <file>", "export interactive HTML report to file")
    .option("--sarif <file>", "export SARIF 2.1.0 report for GitHub Code Scanning")
    .option("--markdown <file>", "export GitHub Flavored Markdown summary to file")
    .option("--ignore-file <file>", "path to custom ignore file (default: .repodoctorignore)")
    .option("--baseline <file>", "path to baseline file to suppress existing findings")
    .option("--update-baseline", "generate or update baseline file from current scan")
    .option("--new-only", "report only new findings not recorded in baseline")
    .option("--max-files <number>", "maximum number of files to scan (default: 5000)")
    .option("--max-file-size <kb>", "maximum file size to scan in KB (default: 1024)")
    .action(async (dir: string, options: CliOptions) => {
      try {
        const style = resolveStyle(options.style);

        const baselinePath = options.baseline ? resolve(process.cwd(), options.baseline) : null;
        let baselineData = null;
        if (baselinePath && !options.updateBaseline) {
          baselineData = await loadBaseline(baselinePath);
        }

        const maxFiles = options.maxFiles ? parseInt(options.maxFiles, 10) : undefined;
        const maxFileSize = options.maxFileSize ? parseInt(options.maxFileSize, 10) * 1024 : undefined;

        const scanOpts = {
          ignoreFile: options.ignoreFile,
          baseline: baselineData,
          newOnly: options.newOnly || (options.ci && !!baselineData),
          maxFiles,
          maxFileSize,
        };

        let result = await scanWithAnimation(dir, style, scanOpts);

        if (baselinePath && options.updateBaseline) {
          await saveBaseline(baselinePath, result.diagnostics);
          console.error(chalk.green(`Baseline snapshot saved to: ${baselinePath}`));
        }

        if (options.fix) {
          const { applied, diffs } = await applyFixes(result.root, result.diagnostics, { dryRun: options.dryRun });
          if (options.dryRun) {
            if (applied.length > 0) {
              console.error(chalk.cyan(`[DRY-RUN] ${applied.length} fix(es) available (no files modified):`));
              for (const diffItem of diffs) {
                console.error(chalk.yellow(`\n--- Unified Diff: ${diffItem.file} ---`));
                console.error(diffItem.diff);
              }
            } else {
              console.error(chalk.dim("[DRY-RUN] No automatic fixes available for current findings."));
            }
          } else {
            if (applied.length > 0) {
              console.error(chalk.green(`Applied ${applied.length} fix(es): ${applied.join("; ")}`));
              result = await scanWithAnimation(dir, style, scanOpts);
            }
          }
        }

        if (options.html) {
          const htmlContent = generateHtmlReport(result);
          const outputPath = resolve(process.cwd(), options.html);
          await writeFile(outputPath, htmlContent, "utf8");
          console.error(chalk.green(`HTML report saved to: ${outputPath}`));
        }

        if (options.sarif) {
          const sarifContent = generateSarifReport(result, version);
          const outputPath = resolve(process.cwd(), options.sarif);
          await writeFile(outputPath, sarifContent, "utf8");
          console.error(chalk.green(`SARIF report saved to: ${outputPath}`));
        }

        if (options.markdown) {
          const mdContent = generateMarkdownReport(result);
          const outputPath = resolve(process.cwd(), options.markdown);
          await writeFile(outputPath, mdContent, "utf8");
          console.error(chalk.green(`Markdown report saved to: ${outputPath}`));
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
      } catch {
        console.error(chalk.red("Unable to analyze the project directory."));
        process.exitCode = 1;
      }
    });

  program
    .command("init-hook")
    .description("install a git pre-commit hook that runs repodoctor before each commit")
    .argument("[dir]", "project root directory", process.cwd())
    .action(async (dir: string) => {
      try {
        const { installPreCommitHook } = await import("./hooks.js");
        const res = await installPreCommitHook(resolve(dir));
        if (res.success) {
          console.log(chalk.green(res.message));
        } else {
          console.error(chalk.red(res.message));
          process.exitCode = 1;
        }
      } catch {
        console.error(chalk.red("Failed to install pre-commit hook."));
        process.exitCode = 1;
      }
    });

  program
    .command("init-ci")
    .description("install GitHub Actions CI workflow to automate RepoDoctor diagnostics")
    .argument("[dir]", "project root directory", process.cwd())
    .option("-f, --force", "overwrite existing repodoctor.yml workflow if present")
    .option("-p, --package-manager <pm>", "package manager to use (npm, pnpm, yarn, bun, auto)", "auto")
    .action(async (dir: string, cmdOptions: { force?: boolean; packageManager?: string }) => {
      try {
        const { installCiWorkflow } = await import("./ci-generator.js");
        const res = await installCiWorkflow(resolve(dir), {
          force: cmdOptions.force,
          packageManager: (cmdOptions.packageManager as any) ?? "auto",
        });
        if (res.success) {
          console.log(chalk.green(res.message));
        } else {
          console.error(chalk.red(res.message));
          process.exitCode = 1;
        }
      } catch {
        console.error(chalk.red("Failed to install CI workflow."));
        process.exitCode = 1;
      }
    });

  program
    .command("init-ignore")
    .description("create a default .repodoctorignore template file")
    .argument("[dir]", "project root directory", process.cwd())
    .action(async (dir: string) => {
      try {
        const { createDefaultIgnoreFile } = await import("./core/ignore.js");
        const res = await createDefaultIgnoreFile(resolve(dir));
        if (res.created) {
          console.log(chalk.green(`Created .repodoctorignore at: ${res.path}`));
        } else {
          console.log(chalk.yellow(`.repodoctorignore already exists at: ${res.path}`));
        }
      } catch {
        console.error(chalk.red("Failed to create .repodoctorignore."));
        process.exitCode = 1;
      }
    });

  program.parse(argv);
}

async function scanWithAnimation(
  dir: string,
  style: ScanStyle,
  scanOpts: Omit<ScanOptions, "onProgress"> = {},
): Promise<ReturnType<typeof scanProject>> {
  let animation: ScanAnimationHandle | null = null;
  if (style === "panel") {
    animation = createScanAnimation();
  }

  try {
    const result = await scanProject(dir, {
      ...scanOpts,
      onProgress: (label) => animation?.progress(label),
    });
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