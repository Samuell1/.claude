import type { PreToolUseHookInput, HookJSONOutput } from "@anthropic-ai/claude-agent-sdk";
import type { BashToolInput } from "./lib/types";
import { rewriteCommand } from "./lib/rewrite";

async function main() {
  const input = (await Bun.stdin.json()) as PreToolUseHookInput;
  if (input.tool_name !== "Bash") process.exit(0);

  const command = (input.tool_input as BashToolInput).command?.trim();
  if (!command) process.exit(0);

  const { command: rewrittenCmd, rewritten } = rewriteCommand(command);
  if (!rewritten) process.exit(0);

  const output: HookJSONOutput = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      updatedInput: { command: rewrittenCmd },
    },
  };

  console.log(JSON.stringify(output));
}

await main();
