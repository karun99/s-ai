# Contributing to S-AI

Thanks for wanting to help.

## Ground rules

- **Security first.** Any change that can execute tools, reach the network,
  or touch credentials must preserve the approval-gate, sandboxing, and
  rate-limit invariants.
- Open an issue before opening a pull request so the design is discussed once.
- Every feature ships with a test in `test/` and is covered by `npm test`
  (`node --test test/*.test.js`).
- Keep the package local-first: no cloud dependency is required to run.

## Verifying

```sh
npm install
npm test
npm run build   # type-check + bundle
```

The security CI (gitleaks, OSV-Scanner, govulncheck, Semgrep, npm audit) runs
on every push.

## Reporting bugs

Search the issues list first. Include the command you ran, the Node version,
and the first ~30 lines of the error.

## Support expectations

Maintained by a single maintainer in spare time. Issues are the channel for
help; expect answers within a week, not minutes.

## License

By contributing you agree that your contributions are licensed under the same
MIT license as the rest of the project.