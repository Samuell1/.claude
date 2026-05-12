
# Claude Code Setup

Personal Claude Code configuration with settings, statusline, hooks, skills, and plugins.

## Links
- [Claude Code Documentation](https://docs.claude.com/claude-code)
- [Claude Log](https://claudelog.com/)

## Prerequisites

[Bun](https://bun.sh/) is required for the statusline source and hooks.

## Setup

Copy and paste this prompt into Claude Code to install globally (into `~/.claude/`):

```
Clone https://github.com/Samuell1/.claude into ~/.claude/, merging settings.json, statusline.ts, and CLAUDE.md into my existing global config. Preserve any existing settings and only update the files from the repo.
```

## What's Inside

- **settings.json** Permissions (allow/deny/ask), enabled plugins, statusline command
- **statusline.ts** Custom status line with context, git info, model, effort, rate limits, session duration
- **hooks/** Optional PreToolUse Bash gate with shared libraries (not wired up in the default settings.json, see Hooks section)
- **CLAUDE.md** Global instructions for scope, communication, workflow, tooling, localization, testing, and docs

## Status Line

The statusline is minimal and non distracting with muted colors and dot separators.

```
my-project ⎇ main +5 -2 ↑1 · 12k/200k 6% · Opus 4.7 (high) · 15m
5h: 34% ⟳ 2:30pm · 7d: 12% ⟳ apr 5, 9:00am
```

**Line 1:**
- **Project and branch** with additions/deletions and ahead/behind remote
- **Context usage** tokens used / max, color coded percentage, red ⚠ warning when over 256k (retrieval quality degrades)
- **Model and effort** combined in one segment. Effort label is tinted by tier (gray for default, blue for low, yellow for medium, orange for high, magenta for xhigh, bold red for max)
- **Session duration** derived from transcript file creation time

**Line 2 (conditional):**
- **Rate limits** 5 hour and weekly usage as percentages with reset times
- Hidden entirely when both are under 10%
- Colors shift from muted green to yellow to red at 80%+

### Performance

The script does a single combined `git status --porcelain=v2 --branch` call, caches results to a tmp file with a 5 second TTL, and reads stdin synchronously to keep startup latency low.

For even lower latency, compile to a native binary and point `statusLine.command` at the compiled output:

```bash
bun build --bytecode --compile ~/.claude/statusline.ts --outfile ~/.claude/statusline.exe
```

Then in `settings.json`:

```json
"statusLine": {
  "type": "command",
  "command": "~/.claude/statusline.exe"
}
```

## Hooks (optional)

The `hooks/` folder ships a single PreToolUse hook (`pre-bash.ts`) that runs before every Bash command. It is not enabled by default in `settings.json`. To enable, add the following to your `settings.json`:

```json
"hooks": {
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        { "type": "command", "command": "bun run ~/.claude/hooks/pre-bash.ts", "timeout": 5 }
      ]
    }
  ]
}
```

The hook combines three concerns in one pass, short circuiting on the first decision.

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

## CLAUDE.md

Global instructions organized into sections:

- **Scope** Verify UI components, form fields, and API endpoints by reading source; never read or print secrets
- **Communication** Use AskUserQuestion for option choices
- **Workflow** TaskCreate for 2+ step work, parallel subagents, explicit subagent model picks (Haiku for grunt, Opus for hard reasoning, Sonnet default)
- **Tooling** Bun over npm, skip frontend builds in dev, scripts/ folder for throwaway work
- **Localization** Code, DB columns, variables, API fields, and comments in English only. UI text may be localized
- **Testing** Tests required for new public functions, API endpoints, and non trivial logic
- **Docs** No em dashes or sentence joining hyphens as punctuation, docs go in `/docs/` folder

## MCP Servers

```bash
# Figma integration
claude mcp add --transport http figma https://mcp.figma.com/mcp

# Sentry error tracking
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
```

## Plugins

- `frontend-design@claude-plugins-official` Frontend design generation
- `skill-creator@claude-plugins-official` Skill creation and testing
- `code-review@power-plugins` Code review for PRs
- `git@power-plugins` Git commit/PR workflows
- `docs@power-plugins` Documentation generation
- `engineering@power-plugins` Engineering helpers
- `cloudflare@power-plugins` Cloudflare power plugin
- `cloudflare@cloudflare` Cloudflare Workers, KV, D1, R2, AI

Marketplaces:
- [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) Default marketplace (built in, available via `/plugin`)
- [dajanarodriguez/claude-plugins](https://github.com/dajanarodriguez/claude-plugins) Extra plugins
- [cloudflare/skills](https://github.com/cloudflare/skills) Cloudflare platform skills
