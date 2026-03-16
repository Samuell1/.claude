
# Claude Code Setup

Personal Claude Code configuration — settings, hooks, statusline, and plugins.

## Links
- [Claude Code Documentation](https://docs.claude.com/claude-code)
- [Claude Log](https://claudelog.com/)

## Setup

Copy and paste this prompt into Claude Code from your project directory:

```
Clone the .claude folder from https://github.com/Samuell1/claude-setup to my current project directory. Copy settings, hooks, and statusline, preserving the folder structure.
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

## MCP Servers

Built-in claude.ai integrations:
- **Figma** — `https://mcp.figma.com/mcp`
- **Sentry** — `https://mcp.sentry.dev/mcp`
- **Chrome** — Claude-in-Chrome browser automation

## Plugins

- `frontend-design@claude-plugins-official` — Frontend design generation
- `code-review@power-plugins` — Code review for PRs
- `git-workflow@power-plugins` — Git commit/PR workflows

Marketplace: [dajanarodriguez/claude-plugins](https://github.com/dajanarodriguez/claude-plugins)
