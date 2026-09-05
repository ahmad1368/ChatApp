---
description: Work the next open GitHub issue for ahmad1368/ChatApp, lowest issue number first
---

Work exactly **one** GitHub issue per invocation of this command: the lowest-numbered **open** issue (`gh issue list --state open --json number --limit 500`, sort ascending). Do not batch multiple issues in one run.

## Branch / PR rules

- Feature branches are cut from `staging`, **never** `main`. `staging` is merged into `main` separately, outside this workflow — that merge is not this command's job.
- Every PR's base is `staging`.
- Branch name: `issue-<n>-<kebab-title>`.
- Reference the issue in commits and the PR body as `Refs #<n>`, not `Closes #<n>` — merging into `staging` does not auto-close the issue on GitHub since `staging` isn't the default branch.
- Close the issue explicitly with `gh issue close <n>` only after confirming its PR actually merged into `staging`.
- **Never** run `gh pr merge` or push to `staging`/`main`. After opening the PR, stop and print the exact merge command (`gh pr merge <N> --squash --delete-branch`) for the user to run themselves once they've reviewed it.

## Steps

1. Pick the lowest-numbered open issue. `gh issue view <n>` for the full body (acceptance criteria, reference app notes).
2. `git fetch origin staging` and branch from `origin/staging` (not local `main`/`staging`, to avoid stale state).
3. Implement the issue against the stack and scoping rules in `CLAUDE.md` — read it first if you haven't this session. In particular: this is a web-first (Next.js PWA + Express/Socket.io) implementation; treat "Android/iOS" acceptance-criteria items as deferred-and-noted, not blocking.
4. Update `README.md`'s "Implemented so far" section with a one-line entry for this issue.
5. Commit (reference `Refs #<n>`), push the branch, and open a PR against `staging` (`gh pr create --base staging --title ... --body "Refs #<n> ..."`).
6. Report back tersely: issue number/title, what was implemented, files touched, the PR URL, and the merge command from the rules above. Do not re-summarize the whole backlog or re-derive already-known state each run.
