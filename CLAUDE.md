# Repository workflow

This local checkout is developed from a fork.

- `origin` is my fork; push local work there.
- `upstream` is the original repository; never push there.
- Keep the upstream-tracking branch (`main` or `master`) clean.
- Work on feature branches and push them to `origin` when they should be backed up or shared.
- Periodically ask whether to check for upstream updates. Before integrating anything, fetch and inspect the upstream commits and changed files, explain likely conflicts or relevant changes, and get confirmation before merging or rebasing them into local work.

Typical sync commands:

```bash
git fetch upstream
git log --oneline --decorate HEAD..upstream/main
git diff --stat HEAD...upstream/main
```

Do not silently pull, merge, rebase, or overwrite local work.
