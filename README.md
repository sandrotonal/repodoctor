# 🩺 RepoDoctor

Diagnose your project before you waste time debugging it.

RepoDoctor is a local-first CLI tool that scans a repository and reports why it may fail to install, start, build, or run correctly. Your code never leaves your machine.

## Quick start

```bash
npx repodoctor
```

## Usage

```bash
repodoctor                      # analyze the current directory
repodoctor ./path/to/project    # analyze a specific directory
repodoctor --json               # machine-readable JSON output on stdout
repodoctor --ci                 # non-zero exit on warnings or worse
repodoctor --fix                # apply safe automatic fixes (e.g. gitignore .env)
```

## What it checks

- **Project & tooling** — detects project files, package managers (`npm`, `yarn`, `pnpm`, `bun`) via lock files, and flags ambiguous/mismatched setup.
- **Node.js** — compares your runtime against `engines.node`, validates the range, and reports script/dependency overview.
- **Dependencies** — warns when `node_modules` or a lock file is missing, and detects when an npm lock file is out of sync with `package.json`. A source-code import scan flags packages that are declared but unused, plus imports that are missing from `package.json`.
- **Environment** — compares `.env` keys against `.env.example` (values are never printed or exported), warns when `.env` is not gitignored, and detects hardcoded ports.
- **Git** — reports branch, detached HEAD, and uncommitted/untracked changes when the project root is its own repository.
- **Ports** — checks declared ports (`PORT` in env files, `config.port` in `package.json`) for live conflicts.
- **Health score** — a 0–100 score and grade summarizing the whole scan.

## Output & exit codes

- Human-readable report including a health score by default.
- `--json` prints a complete, secret-free scan result as JSON on stdout.
- Exit code `1` when a **critical** issue is found (`--ci` additionally exits `1` on warnings).

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
node dist/index.js --help
```

## Status

v0.2.0 — all roadmap items below are complete.

## Roadmap

- [x] CLI bootstrap
- [x] Project scanner
- [x] Package manager detection
- [x] Node.js version checks
- [x] Dependency checks
- [x] Environment checks
- [x] Git diagnostics
- [x] Port conflict detection
- [x] Health score
- [x] JSON output
- [x] CI mode
- [x] Automatic fixes
- [x] Unused / undeclared dependency analysis

## Notes

The unused/undeclared dependency analysis is heuristic: it scans your source files for
import specifiers and cross-checks package.json. Verify flagged packages before removing them.

## License

MIT