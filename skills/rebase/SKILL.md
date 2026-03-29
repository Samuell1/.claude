---
name: rebase
description: Perform a non-interactive git rebase using a scripted todo plan. Use when you need to reorder, squash, fixup, drop, or rename commits without an interactive editor.
---

# Git Rebase (non-interactive)

Uses the `git-rebase.ts` script in this skill folder to perform interactive rebases without an editor.

## Usage

```bash
bun run ~/.claude/skills/rebase/git-rebase.ts HEAD~N << 'EOF'
pick abc123 Commit message
drop def456 Commit to remove
fixup ghi789 Merge into previous commit
squash jkl012 Squash into previous commit
pick mno345 Keep this commit
exec git commit --amend -m "New message for the commit above"
EOF
```

## Available actions

- `pick` — keep the commit as is
- `drop` — remove the commit entirely
- `fixup` — merge into the previous commit, discard this message
- `squash` — merge into the previous commit, combine both messages
- `reword` — keep the commit but change its message (use exec for this)
- `exec <command>` — run a shell command (e.g. `exec git commit --amend -m "New message"`)

## Workflow

1. Run `git log --oneline HEAD~N..HEAD` to see the commits to rebase
2. Build the todo plan with the desired actions for each commit
3. Run the script with the todo piped via heredoc
4. Verify the result with `git log --oneline`

## Important

- This rewrites commit history. Only use on local/unpushed commits, or branches where force push is acceptable.
- If the rebase fails due to conflicts, resolve them manually then run `git rebase --continue`.
- To abort a failed rebase: `git rebase --abort`.
