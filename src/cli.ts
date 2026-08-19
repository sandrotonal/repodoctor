import { Command } from "commander";
import chalk from "chalk";
import pkg from "../package.json" with { type: "json" };

const { version } = pkg;

export function run(argv: string[] = process.argv): void {
  const program = new Command();

  program
    .name("repodoctor")
    .description("Diagnose your project before you waste time debugging it.")
    .version(version, "-v, --version", "output the current version");

  program.action(() => {
    console.log(chalk.cyan("🩺 RepoDoctor"));
    console.log("");
    console.log("Scanning project...");
    console.log("");
    console.log(chalk.yellow("Analysis engine not implemented yet (Phase 2)."));
  });

  program.parse(argv);
}
