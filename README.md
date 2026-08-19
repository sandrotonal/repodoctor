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

v0.1.0 — TypeScript CLI bootstrap. Detectors are implemented incrementally (see roadmap).

## Roadmap

- [x] CLI bootstrap
- [ ] Project scanner
- [ ] Package manager detection
- [ ] Node.js version checks
- [ ] Dependency checks
- [ ] Environment checks
- [ ] Git diagnostics
- [ ] Port conflict detection
- [ ] Health score
- [ ] JSON output
- [ ] CI mode
- [ ] Automatic fixes

## License

MIT
