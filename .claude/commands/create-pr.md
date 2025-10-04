# Create Pull Request Command

Create a new branch, commit changes, and submit a pull request using the commit-assistant agent for optimal commit structuring.

## Behavior
- Creates a new branch based on current changes
- Branch name should have prefix `feat/` or `fix/` based on the nature of changes
- Formats PHP files using PHP_CodeSniffer (PSR-2 with October CMS exceptions)
- **Uses commit-assistant agent** to analyze changes and create well-structured commits
- Automatically applies conventional commit format (`feat:`, `fix:`, `docs:`, etc.)
- Intelligently splits complex changes into atomic commits when beneficial
- Each commit focuses on a single logical change or feature
- Runs relevant tests to ensure code quality
- Pushes branch to remote
- Creates pull request with proper summary and test plan targeting the `develop` branch
- Do NOT add Claude co-authorship footer to commits

## Commit Assistant Integration

The command leverages the commit-assistant agent to:

- Analyze staged changes and suggest optimal commit structure
- Apply conventional commit message format automatically
- Split large changesets into focused, reviewable commits
- Ensure each commit is atomic and self-contained
- Follow project-specific commit guidelines and quality standards

## Commit Splitting Strategy

The commit-assistant will automatically evaluate changes and split commits based on:

- **Different concerns**: Unrelated parts of the codebase
- **Change types**: Features, fixes, documentation, refactoring
- **File patterns**: Source code vs documentation vs configuration
- **Logical grouping**: Changes that benefit from separate review
- **Size considerations**: Large changes broken into digestible units

## Example Commit Sequence

For complex changes, the assistant might create commits like:

- `feat: implement user authentication system`
- `docs: update API documentation for auth endpoints`
- `test: add unit tests for authentication flow`
- `fix: resolve linting issues in auth components`

Remember to use the GitHub CLI (`gh`) for all GitHub-related tasks.
