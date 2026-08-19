# 🩺 RepoDoctor

Diagnose your project before you waste time debugging it.

RepoDoctor is a local-first CLI tool that scans a repository and reports why it may fail to install, start, build, or run correctly. Your code never leaves your machine.

## Quick start

```bash
npx repodoctor
```

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
node dist/index.js --help
```

## Status

v0.1.0 — TypeScript CLI. Detectors are implemented incrementally (see roadmap).

## Usage

```bash
repodoctor                      # analyze the current directory
repodoctor ./path/to/project    # analyze a specific directory
repodoctor --json               # machine-readable JSON output
repodoctor --ci                 # non-zero exit on warnings or worse
repodoctor --fix                # apply safe automatic fixes (e.g. gitignore .env)
```

Checks include project/package-manager detection, Node.js version vs `engines`, dependency
install state and npm lock-file sync, plus unused / undelcared dependency analysis from an
import scan of your source files.

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

## License

MIT
