<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Node.js-339933.svg?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Next.js-000000.svg?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/Vite-646CFF.svg?style=for-the-badge&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Monorepo-pnpm%20%7C%20Turbo-F69220.svg?style=for-the-badge&logo=pnpm&logoColor=white" alt="Monorepo">
  <img src="https://img.shields.io/badge/Security-Secret%20Scanner-red.svg?style=for-the-badge&logo=securityscorecard&logoColor=white" alt="Security">
  <img src="https://img.shields.io/badge/SARIF-GitHub%20Code%20Scanning-blue.svg?style=for-the-badge&logo=githubactions&logoColor=white" alt="SARIF">
  <img src="https://img.shields.io/badge/Test-Vitest%20(179%20passed)-2EA44F?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest">
  <img src="https://img.shields.io/badge/Benchmark-Throughput%20Engine-brightgreen?style=for-the-badge&logo=speedtest&logoColor=white" alt="Benchmark">
  <img src="https://img.shields.io/badge/Exit_Codes-Deterministic%200--4-informational?style=for-the-badge&logo=gnubash&logoColor=white" alt="Exit Codes">
  <img src="https://img.shields.io/badge/Zero_Leak-Shannon_Entropy-blueviolet?style=for-the-badge&logo=auth0&logoColor=white" alt="Zero Leak">
  <img src="https://img.shields.io/badge/Baseline-SHA--256-ff69b4?style=for-the-badge&logo=git&logoColor=white" alt="Baseline">
  <img src="https://img.shields.io/github/license/sandrotonal/repodoctor?style=for-the-badge&logo=opensourceinitiative&color=8A2BE2" alt="License">
</p>

# RepoDoctor

> **Local-first repository health, security, framework, and monorepo diagnostic engine.**  
> Diagnose why your project fails to install, build, or deploy — and catch leaked secrets before you push.

RepoDoctor inspects your codebase locally in milliseconds. Your code **never leaves your machine**.

---

## What's New in v0.6.0 (Enterprise Hardening)

- **Large Repo Benchmark Engine**: Measure scanning performance, memory footprint, throughput (files/sec and MB/sec), and detailed skip reasons (`repodoctor benchmark [dir] [--json]`).
- **Deep Supply-Chain Security**: Flags dangerous lifecycle install scripts (`curl | sh`, `wget | sh`, `powershell -enc`, `base64 -d | sh`), unencrypted HTTP/git dependencies, wildcard/latest versions, and typosquatting attacks against top npm packages using Levenshtein distance metrics.
- **Deterministic Exit Codes Contract**: Guaranteed status codes for CI/CD pipelines (0: SUCCESS, 1: FINDINGS_THRESHOLD, 2: CLI_USAGE_ERROR, 3: SCAN_ABORTED_IO, 4: EXPORT_FAILED) with `--fail-on <critical|warning|info>` and `--strict` options.
- **GitHub Action SHA Pinning**: `repodoctor init-ci --pin-actions` generates CI workflows with immutable 40-character commit SHAs instead of mutable tags.
- **Zero Raw Secret Leakage & Anti-Injection**: In-memory secret masking (`AKIA****PLE`), strict HTML escaping, Markdown sanitization, ANSI control character stripping, and path traversal guards.
- **Stale Baseline & Ignore Syntax Diagnostics**: Emits actionable warnings for invalid syntax in `.repodoctorignore` and flags stale entries in `.repodoctor-baseline.json`.
- **Shannon Entropy Confidence Scoring**: Eliminates false positives by evaluating mathematical entropy for high-entropy tokens, while suppressing dummy & documentation keys (`AKIAIOSFODNN7EXAMPLE`, `sk_test_...`).
- **Decoupled Dual Scoring**: Separate **Security Health (0–100)** and **Reliability Health (0–100)** scoring so non-critical lints never mask active security leaks.
- **TypeScript Compiler API AST Parser**: Source import scanning uses true AST parsing, completely eliminating false positives from code comments and string literals.
- **Multi-Package Manager CI Generation**: Command `init-ci -p <npm|pnpm|yarn|bun>` tailors GitHub Actions pipelines with respective setup actions and execution tools (`npx`, `pnpm dlx`, `yarn dlx`, `bunx`).
- **Safe Auto-Fix with Dry-Run**: Preview configuration fixes as unified diffs (`repodoctor --fix --dry-run`) protected by strict symlink and path traversal guards.

---

## Quick Start

No installation required:

```bash
npx @gucluyumhe/repodoctor
```

Run benchmark metrics on your repository:

```bash
npx @gucluyumhe/repodoctor benchmark
```

Generate a `.repodoctorignore` template:

```bash
npx @gucluyumhe/repodoctor init-ignore
```

Install automated CI workflow with pinned actions (supports npm, pnpm, yarn, bun):

```bash
npx @gucluyumhe/repodoctor init-ci --pin-actions
```

Install git pre-commit protection in 1 second:

```bash
npx @gucluyumhe/repodoctor init-hook
```

---

## Features & Diagnostic Modules

| Module | What RepoDoctor Detects |
| :--- | :--- |
| **Security & Secrets** | Real-time scanner for **hardcoded API keys** (Google Gemini, Anthropic Claude, OpenAI, AWS, HuggingFace, GitHub, Stripe, Slack, Discord, Telegram, JWTs, Private RSA/SSH Keys, Database credentials with passwords) with **Shannon entropy analysis**, dummy credential suppression, and **zero raw secret leakage** (strict in-memory masking). |
| **Package Supply Chain** | Detects **dangerous lifecycle scripts** (`curl\|sh`, `base64\|sh`, `powershell`), unencrypted git/http dependencies, wildcard versions, **typosquatting attacks** via Levenshtein distance (`cross-env.js`, `lodashs`, `axois`), deprecated packages, and missing licenses. |
| **Benchmark & Performance** | Benchmarks repository scanning throughput (files/sec, MB/sec), peak memory RSS delta, and granular skip telemetry (`ignored`, `binary`, `tooLarge`, `permissionDenied`, `unsupportedExtension`, `scanLimit`). |
| **CI/CD Workflow Health** | Scans `.github/workflows/` for missing checkouts, missing Node.js setup, unpinned action versions, missing node-version declarations, and unmonitored pull requests. Generates hardened CI with `--pin-actions`. |
| **Framework Health** | Deep checks for **Next.js** (`"use client"` components leaking `server-only` or database clients), **Vite & Next.js Env Prefix Mismatches** (e.g. using `NEXT_PUBLIC_` in Vite or `VITE_` in Next.js), and missing **TailwindCSS / PostCSS** configurations. |
| **Monorepo & Workspaces** | Inspects **pnpm workspaces**, **Turborepo**, **Lerna**, and **npm/yarn workspaces**. Flags **dependency version drift** across workspace sub-packages (`packages/*`, `apps/*`). |
| **TypeScript Health** | Validates `tsconfig.json`, flags disabled `strict` mode, missing `skipLibCheck`, and orphan `.ts` files without a configuration. |
| **Docker & DevOps** | Detects `Dockerfile` without `.dockerignore`, ensuring `node_modules`, `.env`, and `.git` are not accidentally leaked into image build contexts. |
| **Dependencies & Lockfiles** | Detects package managers (`npm`, `yarn`, `pnpm`, `bun`), ambiguous lockfiles, lockfile desyncs, plus **unused** & **undeclared** packages via **true TypeScript Compiler AST parsing** (ignoring code comments). |
| **Environment & Git** | Validates `.env` against `.env.example` key mismatches, checks unignored `.env` files (values are **never** logged or exported), and monitors git tree status. |
| **Live Port Conflicts** | Binds live TCP sockets to detect if ports declared in `.env` (`PORT=3000`) or `package.json` are already in use. |
| **Deterministic Baselines** | SHA-256 fingerprint snapshotting (`--baseline`, `--update-baseline`, `--new-only`) to suppress legacy findings on brownfield repositories with stale findings detection. |
| **Deterministic Exit Codes** | Strict exit code contract (0–4) with configurable threshold flags (`--fail-on <critical\|warning\|info>`, `--strict`). |
| **Multi-Format Export** | Beautiful terminal panel UI with animations, pure JSON (`--json`), **Interactive Dark-mode HTML Dashboard** (`--html`), **SARIF 2.1.0** for GitHub Code Scanning, and **GitHub Flavored Markdown** (`--markdown`) for Step Summaries. |
| **Smart Auto-Fix & Dry-Run** | Safely repairs configuration drift (`--fix`) with **path traversal guards**, **symlink guards**, and unified diff previews (`--fix --dry-run`). |

---

## Usage & CLI Options

```bash
repodoctor                             # Run diagnosis on current directory
repodoctor ./path/to/project           # Run diagnosis on a specific repository
repodoctor benchmark                   # Benchmark scanning throughput and memory usage
repodoctor benchmark --json            # Output benchmark telemetry as pure JSON
repodoctor init-ignore                 # Create a default .repodoctorignore template
repodoctor init-ci                     # Generate GitHub Actions CI workflow (auto-detects npm, pnpm, yarn, bun)
repodoctor init-ci --pin-actions       # Generate CI workflow with immutable action commit SHAs
repodoctor init-hook                   # Install git pre-commit hook to block secret leaks
repodoctor --baseline .baseline.json   # Suppress known issues recorded in baseline snapshot
repodoctor --baseline .baseline.json --update-baseline # Generate or refresh baseline snapshot
repodoctor --ci --new-only             # CI mode: exit non-zero only on new issues not in baseline
repodoctor --fail-on warning           # Configure failure threshold (critical, warning, info)
repodoctor --strict                    # Strict mode: fail on any warnings or critical issues
repodoctor --html report.html          # Generate interactive standalone HTML dashboard
repodoctor --markdown summary.md       # Generate GitHub Flavored Markdown summary for CI
repodoctor --sarif results.sarif       # Export SARIF 2.1.0 for GitHub Security tab
repodoctor --fix                       # Apply safe automated fixes
repodoctor --fix --dry-run             # Preview automated fixes as unified diffs without touching files
repodoctor --max-files 2000            # Limit scan to 2,000 files for high-speed audits
repodoctor --max-file-size 512         # Skip files larger than 512 KB
repodoctor --ci                        # Non-zero exit code on warnings or critical errors
repodoctor --json                      # Machine-readable JSON output
repodoctor --style plain               # Plain text mode (default in non-TTY/CI)
repodoctor --style panel               # Rich gradient panel UI with health gauge
```

---

## Deterministic Exit Codes Contract

RepoDoctor provides deterministic exit codes for predictable pipeline integration:

| Exit Code | Constant | Meaning |
| :---: | :--- | :--- |
| **0** | `SUCCESS` | Scan completed and no configured threshold was exceeded. |
| **1** | `FINDINGS_THRESHOLD` | Findings exceeded the configured threshold (e.g. critical issues in default mode, or warnings in `--ci` / `--strict` / `--fail-on warning`). |
| **2** | `CLI_USAGE_ERROR` | Invalid CLI arguments, unrecognized flags, or malformed options. |
| **3** | `SCAN_ABORTED_IO` | Target directory does not exist or critical filesystem I/O error aborted the scan. |
| **4** | `EXPORT_FAILED` | Failed to write output report (`--html`, `--sarif`, `--markdown`) due to permission or filesystem error. |

---

## Suppressions via `.repodoctorignore`

Ignore specific files or fine-grained rules by creating a `.repodoctorignore` in your project root:

```gitignore
# Exclude entire directories from all scans
tests/fixtures/**
examples/**
docs/**

# Rule-specific suppression: <rule-id>:<file-pattern>
secret.aws-key:examples/aws-demo.ts
framework.tailwind.missing-config:packages/legacy-app/**
```

---

## Deterministic Baseline Snapshotting

Adopt RepoDoctor on large brownfield repositories without failing existing builds:

```bash
# 1. Snapshot all existing legacy findings
npx @gucluyumhe/repodoctor --baseline .repodoctor-baseline.json --update-baseline

# 2. In CI, only fail pull requests that introduce NEW issues
npx @gucluyumhe/repodoctor --ci --baseline .repodoctor-baseline.json --new-only
```

---

## Safe Auto-Fix Engine & Dry-Run (`--fix`, `--dry-run`)

RepoDoctor can safely repair configuration drift without touching your core application logic. Test changes safely before applying them:

```bash
# Preview what would change via unified diffs (0 files modified)
npx @gucluyumhe/repodoctor --fix --dry-run

# Apply verified fixes
npx @gucluyumhe/repodoctor --fix
```

- **Symlink & Path Traversal Protected**: Prevents attacks targeting symlinks or malicious rule filenames.
- **Generates minimal `tsconfig.json`** if TypeScript files exist without a configuration.
- **Creates `tailwind.config.js`** if Tailwind is installed in dependencies but unconfigured.
- **Generates `.env.example`** from `.env` keys with placeholder values.
- **Creates optimized `.dockerignore`** excluding `node_modules`, `.env`, and `.git`.
- **Adds unignored `.env`, `.env.local`, and sensitive certificate/key files** (`.pem`, `.key`, `id_rsa`) to `.gitignore`.

---

## Interactive HTML Dashboard (`--html report.html`)

Generate a standalone, zero-dependency HTML report to review with your team or attach to CI artifacts:

```bash
npx @gucluyumhe/repodoctor --html ./repodoctor-report.html
```

- **Sleek Dark Theme UI** with responsive layout.
- **Dual Score Gauges**: Overall Health, Security Health, and Reliability Health (0–100).
- **Scan Coverage Metrics**: Files scanned, files skipped, and duration in milliseconds.
- **Interactive Filtering** by severity (Critical, Warning, Info, Passed).
- **Hardened Security**: Complete HTML escaping preventing XSS injection.

---

## GitHub Actions CI/CD Integration

Set up automated pull request scanning in 1 second:

```bash
npx @gucluyumhe/repodoctor init-ci
```

Or tailor it for your package manager (`pnpm`, `yarn`, `bun`, `npm`):

```bash
npx @gucluyumhe/repodoctor init-ci -p pnpm
```

Generated `.github/workflows/repodoctor.yml`:

```yaml
name: RepoDoctor Health & Security Scan

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

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Run RepoDoctor Diagnostic Scan
        run: npx @gucluyumhe/repodoctor --ci --sarif repodoctor.sarif --markdown $GITHUB_STEP_SUMMARY

      - name: Upload Security SARIF to GitHub Code Scanning
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: repodoctor.sarif
```

---

## Local Development

```bash
# Clone the repository
git clone https://github.com/sandrotonal/repodoctor.git
cd repodoctor

# Install dependencies
npm install

# Run typecheck
npm run typecheck

# Build with tsup
npm run build

# Run test suite with Vitest (152 tests)
npm test
```

---

## License

MIT © [Ömer Özbay](https://gucluyumhe.dev/)
