
# Claude Code Setup

Personal Claude Code configuration with settings, hooks, statusline, and plugins.

## Links
- [Claude Code Documentation](https://docs.claude.com/claude-code)
- [Claude Log](https://claudelog.com/)

## Prerequisites

[Bun](https://bun.sh/) is required for the statusline and hooks to run.

## Setup

Copy and paste this prompt into Claude Code to install globally (into `~/.claude/`):

```
Clone https://github.com/Samuell1/.claude into ~/.claude/, merging settings.json, hooks/, statusline.ts, and CLAUDE.md into my existing global config. Preserve any existing settings and only update the files from the repo.
```

## What's Inside

- **settings.json** Permissions (allow/deny/ask), plugins, hooks config
- **hooks/** Single PreToolUse Bash gate with shared libraries (see Hooks section)
- **statusline.ts** Custom status line with context, git info, model, effort, rate limits, session duration
- **CLAUDE.md** Global instructions for scope, communication style, workflow, tooling, localization, and documentation rules

## Hooks

A single PreToolUse hook (`pre-bash.ts`) runs before every Bash command. It combines three concerns in one pass, short circuiting on the first decision.

| Stage | Purpose |
|-------|---------|
| Prefer tools | Blocks Bash when a dedicated tool exists (e.g. `cat` → Read, `grep` → Grep). Skips when the command uses pipes, chains, or redirections. |
| Rewrite pm | Rewrites `npm`/`npx`/`yarn`/`pnpm` commands to `bun` automatically before the permission check runs. |
| Permissions | Decomposes compound commands (`&&`, `\|`, `;`, `$()`, brace groups, bare subshells) and matches each sub command against allow/deny/ask patterns from settings.json. |

Shared libraries in `hooks/lib/`:

| Module | Purpose |
|--------|---------|
| `shell.ts` | Command splitting, operator parsing, sub command extraction |
| `patterns.ts` | Glob pattern matching for permission rules |
| `settings.ts` | Reads and caches settings.json |
| `rewrite.ts` | Package manager command rewriting logic |
| `types.ts` | Shared type definitions |

Tests live in `hooks/__tests__/` and can be run with `bun test`.

## Status Line

The statusline is minimal and non distracting with muted colors and dot separators.

```
my-project ⎇ main +5 -2 ↑1 · 12k/200k 6% · Opus 4.7 (max) · 15m
5h: 34% ⟳ 2:30pm · 7d: 12% ⟳ apr 5
```

**Line 1:**
- **Project and branch** with dirty indicator, additions/deletions, ahead/behind remote
- **Context usage** tokens used / max, color coded percentage, red ⚠ warning when over 256k (retrieval quality degrades)
- **Model and effort** combined in one segment. Effort label is tinted by tier (gray for default, blue for low, yellow for medium, orange for high, magenta for xhigh, bold red for max)
- **Session duration** derived from transcript file creation time

**Line 2 (conditional):**
- **Rate limits** 5 hour and weekly usage as percentages with reset times
- Hidden entirely when both are under 10%
- Colors shift from muted green → yellow → red at 80%+

## Skills

Custom skills invoked via `/skill-name` in Claude Code.

| Skill | Description |
|-------|-------------|
| `rebase` | Non interactive git rebase using a scripted todo plan. Supports pick, drop, fixup, squash, reword, and exec actions. Uses a temp file as `GIT_SEQUENCE_EDITOR` so no interactive editor is needed. |

Usage: `/rebase` then describe what commits to reorder, squash, or drop.

## Agents

Custom agents for specialized tasks, launched via the Agent tool.

| Agent | Model | Description |
|-------|-------|-------------|
| `task-planner` | Opus | Breaks down complex tasks into phased implementation plans with dependencies, risk warnings, and verification checklists. |

## CLAUDE.md

Global instructions organized into sections:

- **Scope Control** Only modify files explicitly requested, verify assumptions by reading source
- **Communication** Confidence threshold for asking clarification, critical feedback style, minimal emoji usage
- **Workflow** Parallel subagents, task tracking with dependencies, systematic error handling
- **Tooling** Bun over npm, skip frontend builds in dev, gh CLI for GitHub
- **Localization** Code, DB columns, variables, API fields, and comments in English only. UI text may be localized
- **Writing docs / README** No dashes as punctuation, docs go in `/docs/` folder

## MCP Servers

```bash
# Figma integration
claude mcp add --transport http figma https://mcp.figma.com/mcp

# Sentry error tracking
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
```

## Plugins

- `frontend-design@claude-plugins-official` Frontend design generation
- `code-review@power-plugins` Code review for PRs
- `git-workflow@power-plugins` Git commit/PR workflows
- `skill-creator@claude-plugins-official` Skill creation and testing
- `docs@power-plugins` Documentation generation
- `cloudflare@cloudflare` Cloudflare Workers, KV, D1, R2, AI

Marketplaces:
- [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) Default marketplace (built in, available via `/plugin`)
- [dajanarodriguez/claude-plugins](https://github.com/dajanarodriguez/claude-plugins) Extra plugins
- [cloudflare/skills](https://github.com/cloudflare/skills) Cloudflare platform skills
