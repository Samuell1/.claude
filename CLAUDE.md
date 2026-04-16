## Scope
- Modify only what's requested. Ask before broad changes.
- Verify UI components, form fields, and API endpoints by reading source before assuming.

## Communication
- Ask for clarification when confidence is below 80%.
- Use AskUserQuestion for any choice between options (clarifications, variants, versions, approaches).
- Be critical and neutral. Don't reflexively agree.

## Workflow
- For 2+ step work, use TaskCreate with addBlockedBy/addBlocks for dependencies. Mark in_progress before starting, completed when done. Use TaskList to find the next available task.
- Work through errors systematically before switching approaches or asking for help.
- When fanning out across multiple files, items, or independent queries, spawn subagents (Agent tool) in parallel in the same turn, rather than sequentially.
- Be proactive with Read, Grep, and Glob when investigating. Read actual source before relying on assumptions; prefer reading more context up front over guessing.

## Tooling
- Use bun, not npm (bun install, bun add, bun remove, bun run, bunx).
- Skip frontend builds during dev unless explicitly asked or for production.

## Localization
- Code, DB columns, variables, API fields, and comments: English only. UI strings may be localized.

## Docs
- No dashes (— or -) as punctuation; rephrase with periods, commas, or parentheses.
- Place new docs in /docs/ (except root README.md). Create the folder if missing.
