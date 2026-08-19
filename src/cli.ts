import { Command } from "commander";
import chalk from "chalk";
import pkg from "../package.json" with { type: "json" };
import { scanProject } from "./core/scanner.js";
import { renderScan } from "./output/terminal.js";

const { version } = pkg;

export function run(argv: string[] = process.argv): void {
  const program = new Command();

  program
    .name("repodoctor")
    .description("Diagnose your project before you waste time debugging it.")
    .version(version, "-v, --version", "output the current version")
    .argument("[dir]", "project directory to analyze", process.cwd())
    .action(async (dir: string) => {
      try {
        const result = await scanProject(dir);
        renderScan(result);
        if (result.diagnostics.some((diagnostic) => diagnostic.severity === "critical")) {
          process.exitCode = 1;
        }
      } catch (error) {
        console.error(chalk.red("✗ Unable to analyze the project directory."));
        process.exitCode = 1;
      }
    });

  program.parse(argv);
}