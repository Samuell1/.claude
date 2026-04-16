## Scope Control
- Only modify files explicitly requested. Do not create extra files, rename existing features, or restructure beyond the stated scope. Ask before making broad changes.
- Before assuming UI components, form fields, or API endpoints exist, verify by reading the actual source code first. Never assume default configurations or field names.

## Communication
- When you are not sure or your confidence is below 80%, ask the user for clarification, guidance or more context
- Use AskUserQuestionTool whenever user needs to make a choice: clarifications, variants, versions, approaches, or any decision between multiple options
- Do not tell me I am right all the time. Be critical. We're equals. Try to be neutral and objective
- Do not excessively use emojis

## Workflow
- Use subagents to parallelize work when handling multiple files or independent tasks
- When there are multiple things to do at once (2+ steps), use TaskCreate to create a checklist of tasks with dependencies (addBlockedBy/addBlocks). Mark tasks in_progress before starting and completed when done. Use TaskList to track overall progress and find the next available task
- When facing errors, work through them systematically before switching approaches or asking for help

## Tooling
- Always use bun instead of npm for all package management tasks: 'bun install', 'bun add', 'bun remove', 'bun run', 'bunx', etc.
- Skip frontend build commands during development (hot reload handles it). Only run build when explicitly asked or for production
- For questions about GitHub, use the gh CLI tool

## Localization
- All code, database columns, variables, API fields, and comments must be in English only. User facing content (UI labels, messages) may be localized as needed.

## Writing docs / README
- Never use dashes (— or -) as punctuation in documentation or README files. Rephrase sentences using periods, commas, or parentheses instead
- When creating any documentation or markdown files (other than README.md at the repo root), place them in a `/docs/` folder within the repository. Create the folder if it doesn't exist
