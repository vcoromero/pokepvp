---
name: branch-changes-commit-pr
description: Verifies changes in the current branch and produces a conventional commit message and optional PR description. Use when the user wants a commit message, PR description, or to summarize branch changes for a conventional commit or pull request.
---

# Branch Changes → Conventional Commit & PR

Analyze the current branch diff, summarize what changed, and output a conventional commit message and (optionally) a PR description.

## Workflow

1. **Determine base branch**  
   Use `main` or `master` as the comparison base (infer from repo: `git branch -a`, or default to `main`).

2. **Gather branch changes**  
   - `git status` — see modified/added/deleted files.  
   - `git diff <base>...HEAD` or `git diff <base> --stat` — see what changed compared to base.  
   - Optionally: `git log <base>..HEAD --oneline` — list commits on the branch.

3. **Summarize changes**  
   In one or two short sentences, state what the branch does (features, fixes, refactors, docs, etc.).

4. **Output**  
   - A **conventional commit** line (and optional body).  
   - If the user asked for a PR or “possible PR”, also output a **PR description** (title + body).

## Conventional Commit Format

```
<type>(<scope>): <short description>

[optional body]
[optional footer]
```

**Types:** `feat` | `fix` | `docs` | `style` | `refactor` | `perf` | `test` | `chore` | `build` | `ci` | `revert`.

**Scope:** optional, lowercase; e.g. `auth`, `api`, `catalog`.

**Rules:**
- First line ≤ 72 characters; imperative mood (“add” not “added”).
- Body and footer optional; use body for “why” or details when helpful.
- Breaking change: add `!` after type/scope or use footer `BREAKING CHANGE: <description>`.

## PR Description Template

Use this when the user wants a PR description:

```markdown
## Summary
<1–3 sentences on what this PR does and why>

## Changes
- <change 1>
- <change 2>
- …

## Notes
<optional: testing, follow-ups, breaking changes>
```

PR title should match the conventional commit subject (e.g. `feat(catalog): add pagination to list endpoint`).

## Examples

**Example 1 — Single feature**  
Diff: new route `GET /catalog/list?page=&limit=`, pagination in service.

Commit:
```
feat(catalog): add pagination to list endpoint

Query params: page, limit. Defaults: page=1, limit=20.
```

PR title: `feat(catalog): add pagination to list endpoint`  
PR body: Summary + bullet list of changes (new route, service pagination, defaults).

**Example 2 — Bugfix**  
Diff: fix timezone in date formatting in reports.

Commit:
```
fix(reports): correct date formatting in timezone conversion
```

**Example 3 — Mixed**  
Diff: new health check, dependency bump, README update.

Commit (single logical change):
```
chore: improve health check and update README

- Add /health dependency checks
- Bump axios to 1.6
- Document env vars in README
```

Or split into multiple commits if the user prefers one type per commit.

## Checklist Before Output

- [ ] Compared against correct base (`main` or `master`).
- [ ] Commit type and scope match the actual changes.
- [ ] Subject is imperative and under 72 characters.
- [ ] If PR requested: PR title matches commit subject; body has Summary + Changes.
