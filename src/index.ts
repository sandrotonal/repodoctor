#!/usr/bin/env node
import { run } from "./cli.js";

try {
  run();
} catch (error) {
  console.error("✗ Unexpected error running RepoDoctor.");
  process.exitCode = 1;
}
