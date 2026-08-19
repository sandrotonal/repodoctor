import { Command } from "commander";
import chalk from "chalk";
import pkg from "../package.json" with { type: "json" };
import { scanProject } from "./core/scanner.js";
import { renderScan } from "./output/terminal.js";
import { renderJson } from "./output/json.js";
import { applyFixes } from "./fixes.js";

const { version } = pkg;

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
    .action(async (dir: string, options: { json: boolean; ci: boolean; fix: boolean }) => {
      try {
        let result = await scanProject(dir);

        if (options.fix) {
          const { applied } = await applyFixes(result.root, result.diagnostics);
          if (applied.length > 0) {
            console.log(chalk.green(`✓ Applied ${applied.length} fix(es): ${applied.join("; ")}`));
            result = await scanProject(dir);
          }
        }

        if (options.json) {
          renderJson(result);
        } else {
          renderScan(result);
        }

        const hasCritical = result.diagnostics.some((diagnostic) => diagnostic.severity === "critical");
        const hasWarning = result.diagnostics.some((diagnostic) => diagnostic.severity === "warning");
        if (options.ci ? hasCritical || hasWarning : hasCritical) {
          process.exitCode = 1;
        }
      } catch (error) {
        console.error(chalk.red("✗ Unable to analyze the project directory."));
        process.exitCode = 1;
      }
    });

  program.parse(argv);
}