---
name: git-commit
description: Commit and push workflow for this repository. Use whenever you are about to commit, push or open a pull request.
---

# Git commit workflow

## Hard rules

- **Never** add `Co-Authored-By:` trailers, "Generated with Claude Code" or any other signature or attribution to a commit message or a pull request.
- **Never** change `git config user.name` or `git config user.email`. Commits are authored by the identity that is already configured.
- **Never** use `--no-verify` (or `-n`), and never disable or skip hooks.
- **Never** commit secrets: `.env` files, keys, credentials, `.claude/settings.local.json`.
- **Never** force-push `main` or rewrite history that is already pushed.

## Step 0: check the setup

```bash
git config core.hooksPath   # must print .githooks
git config user.name        # must not be empty
git config user.email       # must not be empty
```

- If `core.hooksPath` is empty, run `git config core.hooksPath .githooks`. The `commit-msg` hook strips attribution lines.
- If the name or the email is empty, **stop and ask the user**. Do not set them yourself and do not invent them.

## Step 1: review and group the changes

```bash
git status
git diff            # unstaged changes
git diff --staged   # staged changes
```

- Group the changes into small, logical commits with one purpose each: a feature with its tests, a refactor, a docs update.
- Stage by path: `git add <path> …`. Use `git add -A` only when every change belongs in the same commit.
- Before committing, check what is staged (`git diff --staged --stat`): no secrets, build output or local files.

## Step 2: run the checks

Run the root scripts that exist in `package.json` (`npm run` lists them):

```bash
npm run lint
npm run typecheck
npm test
```

- Do not commit if any of them fails. Fix the cause; never skip, disable or weaken tests or lint rules to get a green run.
- If a script does not exist yet (early in the project), skip it and say so in your report.

## Step 3: write the message

Conventional Commits, in English:

```text
<type>(<scope>): <description>

<optional body: why the change was needed>
```

- **type**: `feat`, `fix`, `chore`, `docs`, `test` or `refactor`.
- **scope** (optional): the area in kebab-case, e.g. `api`, `web`, `shared`, `db`, `ai`, `spaces`, `snaps`, `skills`.
- **description**: imperative mood ("add", not "added" or "adds"), lowercase start, no final period.
- The first line has **at most 72 characters**.
- The body is optional. It explains _why_, not _what_, with lines wrapped at 72 characters.

Examples:

```text
feat(spaces): add invite codes with expiration and max uses
fix(snaps): strip exif metadata before storing photos
test(ai): cover retry when the snap insight output is invalid
docs: document space endpoints in api.md
```

Commit with a heredoc so the message is exactly what you wrote:

```bash
git commit -F - <<'EOF'
feat(spaces): add invite codes with expiration and max uses

Classmates could only be added one by one by the owner. Invite codes
let them join a shared Space by themselves.
EOF
```

## Step 4: verify the commit

```bash
git log -1 --format='%an <%ae>%n%b'
```

- The author must be the configured identity (`git config user.name` and `git config user.email`).
- The body must not contain `Co-Authored-By`, `Generated with` or any signature. If it does and the commit is not pushed yet, fix it with `git commit --amend` and check again.

## Step 5: push

```bash
git push origin main
```

- **Authentication errors** (`Authentication failed`, `could not read Username`, `Permission denied (publickey)`, HTTP 401 or 403): **stop and tell the user.** Do not try other credentials, remotes or protocols.
- **Rejected because the remote has new commits** (non-fast-forward): run `git pull --rebase origin main`, run the checks again and push. Never force-push.

## Pull requests

The same rules apply to pull requests: a Conventional Commits title, an English description of what changed and why, and no "Generated with Claude Code" line or any other signature.
