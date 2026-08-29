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

## Product constraint: free data sources only

- New TREK features must use free, open-data, self-hosted, or already-available local APIs.
- Do not add a provider that requires payment, a paid tier, a monthly minimum, or a credit card merely to keep a feature working.
- A provider's free tier is acceptable only when the feature remains useful after its published free quota and the quota/terms are documented.
- Never implement a paid-provider fallback that silently incurs charges.
- If no dependable free source exists, drop the feature from the implementation plan and record why.
- Cache public API results, respect attribution and rate limits, and keep provider selection replaceable.
- Preserve `unknown`/approximate values instead of manufacturing data when a free source lacks coverage.
