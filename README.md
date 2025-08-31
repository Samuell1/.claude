
## MCPs

claude mcp add --transport http Ref "https://api.ref.tools/mcp?apiKey=YOUR_API_KEY"
claude mcp add --transport http context7 https://mcp.context7.com/mcp --header "CONTEXT7_API_KEY: YOUR_API_KEY"

claude mcp add playwright npx @playwright/mcp@latest
claude mcp add --transport sse figma-dev-mode-mcp-server http://127.0.0.1:3845/sse
