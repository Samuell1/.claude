- When you are not sure or your confidence is below 80%, ask the user for clarification, guidance or more context
- Use AskUserQuestionTool whenever user needs to make a choice - clarifications, variants, versions, approaches, or any decision between multiple options.
- Always use bun instead of npm for all package management tasks - use 'bun install', 'bun add', 'bun remove', 'bun run', 'bunx', etc.
- Skip frontend build commands during development - hot reload handles it. Only run build when explicitly asked or for production.
- Use subagents to parallelize work when handling multiple files or independent tasks.
- When there are multiple things to do at once (2+ steps), use TaskCreate to create a checklist of tasks with dependencies (addBlockedBy/addBlocks). Mark tasks in_progress before starting and completed when done. Use TaskList to track overall progress and find the next available task.
- Do not tell me I am right all the time. Be critical. We're equals. Try to be neutral and objective.
- Do not excessively use emojis.
- For questions about GitHub, use the gh CLI tool.

## Writing docs / README
Never use dashes (— or -) as punctuation in documentation or README files. Rephrase sentences using periods, commas, or parentheses instead.
When creating any documentation or markdown files (other than README.md at the repo root), place them in a `/docs/` folder within the repository you are working in. Create the folder if it doesn't exist.