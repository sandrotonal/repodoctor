

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Node.js-339933.svg?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/CLI-Commander-000000.svg?style=for-the-badge&logo=gnubash&logoColor=white" alt="Commander">
  <img src="https://img.shields.io/badge/Output-Chalk-f5f5f5.svg?style=for-the-badge&logo=chalk&logoColor=black" alt="Chalk">
  <img src="https://img.shields.io/badge/Bundler-tsup-FF6B6B.svg?style=for-the-badge&logo=esbuild&logoColor=white" alt="tsup">
  <img src="https://img.shields.io/badge/Test-Vitest-FCC72B.svg?style=for-the-badge&logo=vitest&logoColor=black" alt="Vitest">
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/sandrotonal/repodoctor?style=for-the-badge&logo=github&color=FFD54F" alt="Stars">
  <img src="https://img.shields.io/github/package-json/v/sandrotonal/repodoctor?style=for-the-badge&logo=npm&color=CB3837" alt="Version">
  <img src="https://img.shields.io/github/license/sandrotonal/repodoctor?style=for-the-badge&logo=opensourceinitiative&color=8A2BE2" alt="License">
  <img src="https://img.shields.io/badge/tests-94%20passed-2EA44F?style=for-the-badge&logo=vitest&logoColor=white" alt="Tests">
</p>

# RepoDoctor

**Diagnose your project before you waste time debugging it.**

RepoDoctor is a **local-first** CLI tool that scans a repository and reports why it may fail to install, start, build, or run correctly. Your code **never leaves your machine**.

## Features

| Area | What it detects |
| --- | --- |
| **Tooling** | Project files, package managers (`npm` / `yarn` / `pnpm` / `bun`), ambiguous or mismatched lock files |
| **Node.js** | Runtime vs `engines.node`, invalid semver ranges, script & dependency overview |
| **Dependencies** | Missing `node_modules` or lock file, npm lock file out of sync, **unused** and **undeclared** packages via an import scan |
| **Environment** | `.env` vs `.env.example` key mismatches, `.env` not gitignored — values are **never** printed or exported |
| **Git** | Branch, detached HEAD, uncommitted & untracked changes |
| **Ports** | Live conflict checks for declared ports (`PORT` in env files, `config.port` in `package.json`) |
| **Health score** | A 0–100 score with an `EXCELLENT to CRITICAL` grade |

## Quick start

```bash
npx @gucluyumhe/repodoctor
```

## Usage

```bash
repodoctor                      # analyze the current directory
repodoctor ./path/to/project    # analyze a specific directory
repodoctor --style panel        # rich panel output (boxes, gradient, health bar)
repodoctor --style plain        # classic compact output
repodoctor --json               # machine-readable JSON output on stdout
repodoctor --ci                 # non-zero exit on warnings or worse
repodoctor --fix                # apply safe automatic fixes (e.g. gitignore .env)
```

Output style is `auto` by default: **panel** in an interactive terminal (with a live
scan animation) and **plain** for CI/pipelines. Override it with `--style`
or the `REPODOCTOR_STYLE` environment variable (`plain` | `panel` | `auto`).

Exit code is `1` when a **critical** issue is found; `--ci` additionally exits `1` on warnings — perfect for CI pipelines.

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run build       # tsup → dist/index.js
npm test            # build + vitest
```

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
- [x] Rich terminal UI — panel style with scan animation, gradient wordmark and health bar

## Note

The unused/undeclared dependency analysis is heuristic — it scans your source files for
import specifiers and cross-checks `package.json`. Always verify flagged packages before removing them.

---

<p align="center">
  Made by <a href="https://gucluyumhe.dev/"><strong>gucluyumhe.dev</strong></a>
  <br>
  <sub>Diagnose → Fix → Ship → <a href="https://gucluyumhe.dev/">Repeat</a></sub>
</p>

## License

MIT
