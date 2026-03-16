
# Claude Code Setup

Personal Claude Code configuration — settings, hooks, statusline, and plugins.

## Links
- [Claude Code Documentation](https://docs.claude.com/claude-code)
- [Claude Log](https://claudelog.com/)

## Setup

Copy and paste this prompt into Claude Code from your project directory:

```
Clone the .claude folder from https://github.com/Samuell1/.claude to my current project directory. Copy settings, hooks, and statusline, preserving the folder structure.
```

## What's Inside

- **settings.json** — Permissions (allow/deny/ask), plugins, hooks config
- **hooks/PreToolUse.ts** — Smart Bash command validator that decomposes compound commands and checks each sub-command against settings.json patterns. Also rewrites npm/yarn/pnpm commands to bun.
- **statusline.ts** — Custom status line with model info, context usage, git branch, session timer, effort level, and rate limit bars
- **CLAUDE.md** — Global instructions

## Hooks

The `PreToolUse.ts` hook runs before every Bash command and:
1. Rewrites `npm`/`npx`/`yarn`/`pnpm` → `bun` automatically
2. Decomposes compound commands (`&&`, `|`, `;`, `$()`) into sub-commands
3. Checks each sub-command against your allow/deny/ask patterns from settings.json
4. Deny → block, Allow → auto-approve, Ask → prompt for confirmation

## Status Line

The custom statusline shows at a glance:

```
Claude Opus 4.6 │ 125k/1M 12% │ my-project (main*) │ ● high

current ●●●●●○○○○○  50% ⟳ 3:45pm
weekly  ●●○○○○○○○○  20% ⟳ mar 22
```

- **Model name** — which Claude model is active
- **Context usage** — tokens used / max with color-coded percentage
- **Project & branch** — directory name, git branch, dirty indicator
- **Effort level** — current thinking effort setting
- **Rate limits** — 5-hour and weekly usage bars with reset times

## MCP Servers

```bash
# Figma integration
claude mcp add --transport http figma https://mcp.figma.com/mcp

# Sentry error tracking
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
```

## Plugins

- `frontend-design@claude-plugins-official` — Frontend design generation
- `code-review@power-plugins` — Code review for PRs
- `git-workflow@power-plugins` — Git commit/PR workflows

Marketplaces:
- [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) — Default marketplace (built-in, available via `/plugin`)
- [dajanarodriguez/claude-plugins](https://github.com/dajanarodriguez/claude-plugins) — Extra plugins
