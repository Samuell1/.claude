# Changelog

All notable changes to this Claude Code configuration are tracked here. Dates use ISO format (YYYY-MM-DD).

## 2026-05-12

Sync of live `~/.claude/` config into the repo.

### settings.json

- env: added `EDITOR=zed --wait` and `CLAUDE_CODE_FORK_SUBAGENT=1`. Dropped the now redundant `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`.
- permissions.allow: added `bunx vitest`, `bunx eslint`, `bunx biome`, `npm`, `npx`, `yarn`, `pnpm`, `composer`, and `php artisan` patterns.
- permissions.deny: fixed pattern syntax for `Bash(git -C *)` and `Bash(git --no-pager *)` (was `:*`). Added `rm -rf ~` and `rm -rf .` as explicit hard denies.
- permissions.ask: dropped the catch-all `rm`, `rm -r`, and `rm -rf` prompts (the explicit denies above cover the dangerous cases), and dropped the `gh pr create` / `gh issue create` confirmations.
- permissions.defaultMode: switched from `acceptEdits` to `auto`.
- hooks: removed the PreToolUse Bash hook block. The hook source still lives in `hooks/` and can be re-enabled (see README "Hooks (optional)").
- statusLine.command: switched from `bun run ~/.claude/statusline.ts` to the compiled `~/.claude/statusline.exe` for lower startup latency.
- enabledPlugins: renamed `git-workflow@power-plugins` to `git@power-plugins`, enabled `engineering@power-plugins` and `cloudflare@power-plugins`, and explicitly disabled `superpowers@claude-plugins-official` and `guidelines@power-plugins`.
- spinnerVerbs: replaced the default verb list with a single `Thinking` verb.
- effortLevel: `xhigh` -> `high`.
- Dropped `advisorModel`.
- Added `skipDangerousModePermissionPrompt`, `remoteControlAtStartup`, `inputNeededNotifEnabled`, `agentPushNotifEnabled`, `skipAutoPermissionPrompt`.

### statusline.ts

- Replaced `execSync` (spawns a shell) with `execFileSync` for git calls.
- Collapsed four separate git invocations (`rev-parse`, `symbolic-ref`, `status --porcelain`, `rev-list`) into one `git status --porcelain=v2 --branch` call.
- Added a 5 second tmp-file cache keyed by session id and cwd to avoid repeating git work within the same session.
- Replaced `await Bun.stdin.json()` with `readFileSync(0, "utf8")` so the script compiles cleanly with `bun build --bytecode --compile`.
- Effort lookup now reads `input.effort?.level` first, falling back to `input.effort_level` and finally to `settings.json`.
- Removed unused `buildBar`, `gitDirty`, and `white` color. Simplified `formatResetTime` (dropped the unused "date" branch).
- Single trailing `process.stdout.write` to save one syscall when both lines are present.

### CLAUDE.md

- Added "Never read or print contents of .env*, credentials, or token files. Treat secrets as opaque."
- Added explicit subagent model guidance: Haiku for grunt work, Opus for hard reasoning, Sonnet default.
- Added scripts/ folder convention for throwaway scripts.
- Added a Testing section.
- Refined the docs rule: only em-dashes and sentence-joining hyphens are banned. Hyphens in flags, kebab-case, file names, and compound words are fine.
- Removed the "Modify only what's requested", "Ask for clarification when confidence is below 80%", "Be critical and neutral", and TaskCreate-state-machine bullets (the global instructions cover these already).

### README.md

- Updated plugin list to match the new `enabledPlugins`.
- Moved hooks to a dedicated "Hooks (optional)" section since they are no longer wired up by default in `settings.json`.
- Documented the compile-to-`statusline.exe` workflow.
- Refreshed the CLAUDE.md summary to match the new sections.
- Sample statusline output now uses `Opus 4.7 (high)` to reflect the current effort level.
