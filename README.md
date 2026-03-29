
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
- **hooks/** Modular Bash command validators split into separate concerns (see Hooks section)
- **statusline.ts** Custom status line with context, git info, model, effort, rate limits, session duration
- **CLAUDE.md** Global instructions for communication style, workflow, tooling preferences, and documentation rules

## Hooks

The hooks system runs before every Bash command. Each hook is a separate module with shared utilities in `hooks/lib/`.

| Hook | Purpose |
|------|---------|
| `prefer-tools.ts` | Blocks Bash when a dedicated tool exists (e.g. `cat` → Read, `grep` → Grep) |
| `rewrite-pm.ts` | Rewrites `npm`/`npx`/`yarn`/`pnpm` commands to `bun` automatically |
| `permissions.ts` | Decomposes compound commands (`&&`, `\|`, `;`, `$()`) and checks each sub command against allow/deny/ask patterns from settings.json |

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
my-project ⎇ main +5 -2 ↑1 · 12k/200k 6% · Opus 4.6 (high) · 15m
5h: 34% ⟳ 2:30pm · 7d: 12% ⟳ apr 5
```

**Line 1:**
- **Project and branch** with dirty indicator, additions/deletions, ahead/behind remote
- **Context usage** tokens used / max, color coded percentage, red ⚠ warning when over 256k (retrieval quality degrades)
- **Model and effort** combined in one segment
- **Session duration** derived from transcript file creation time

**Line 2 (conditional):**
- **Rate limits** 5 hour and weekly usage as percentages with reset times
- Hidden entirely when both are under 10%
- Colors shift from muted green → yellow → red at 80%+

## CLAUDE.md

Global instructions organized into sections:

- **Communication** Confidence threshold for asking clarification, critical feedback style, minimal emoji usage
- **Workflow** Parallel subagents, task tracking with dependencies, systematic error handling
- **Tooling** Bun over npm, skip frontend builds in dev, gh CLI for GitHub
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
