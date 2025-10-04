
# Claude Code Setup

A curated collection of Claude Code commands, agents, and configurations to supercharge your development workflow.

## Links
- [Claude Code Documentation](https://docs.claude.com/claude-code)
- [Claude Log](https://claudelog.com/)


## Clone This Configuration to Your Project

Copy and paste this prompt into Claude Code from your project directory:

```
Clone the .claude folder from https://github.com/Samuell1/claude-setup to my current project directory. Copy all commands and agents, preserving the folder structure.
```

## MCP Servers

Extend Claude's capabilities with Model Context Protocol servers:

```bash
# Reference documentation
claude mcp add --transport http Ref "https://api.ref.tools/mcp?apiKey=YOUR_API_KEY"

# Context7 knowledge base
claude mcp add --transport http context7 https://mcp.context7.com/mcp --header "CONTEXT7_API_KEY: YOUR_API_KEY"

# Browser automation
claude mcp add playwright npx @playwright/mcp@latest

# Figma integration
claude mcp add --transport sse figma-dev-mode-mcp-server http://127.0.0.1:3845/sse
```


## Contributing

Feel free to add your own commands and agents! Share useful configurations via pull requests.
