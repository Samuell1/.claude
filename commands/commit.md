# Commit Command

Initiate commit-assistant subagent to create well-structured commits, then push to remote.

## Behavior
- Uses commit-assistant agent to analyze changes and create quality commits
- Applies conventional commit format and splits commits when beneficial
- After commits are created locally, pushes changes to remote repository
- Uses `git push` or `git push -u origin <branch>` for new branches

## Workflow
1. **Commit Creation**: commit-assistant handles staging, analysis, and local commits
2. **Push to Remote**: This command handles pushing the commits after they're created
3. **Branch Tracking**: Sets up tracking for new branches as needed
