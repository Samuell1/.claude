import type { PreToolUseHookInput, HookJSONOutput } from "@anthropic-ai/claude-agent-sdk";
import type { BashToolInput } from "./lib/types";

// Maps simple shell commands to their built-in Claude Code equivalents.
// Only triggers on simple usage (no pipes, chains, or redirections).
const TOOL_HINTS: Record<string, string> = {
  cat: "Use the Read tool instead of cat",
  head: "Use the Read tool with limit instead of head",
  tail: "Use the Read tool with offset instead of tail",
  grep: "Use the Grep tool instead of grep",
  rg: "Use the Grep tool instead of rg",
  find: "Use the Glob tool instead of find",
  sed: "Use the Edit tool instead of sed",
  awk: "Use the Grep or Edit tool instead of awk",
};

function isSimpleUsage(command: string): boolean {
  // If it contains pipes, chains, redirections, subshells, or semicolons
  // it's a complex command where shell tools are justified
  return !/[|;&<>]|\$\(|`/.test(command);
}

function getBaseCommand(command: string): string {
  return command.trimStart().split(/\s/)[0];
}

async function main() {
  const input = (await Bun.stdin.json()) as PreToolUseHookInput;
  if (input.tool_name !== "Bash") process.exit(0);

  const command = (input.tool_input as BashToolInput).command?.trim();
  if (!command) process.exit(0);

  const base = getBaseCommand(command);
  const hint = TOOL_HINTS[base];

  if (!hint || !isSimpleUsage(command)) process.exit(0);

  const output: HookJSONOutput = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: hint,
    },
  };

  console.log(JSON.stringify(output));
}

await main();
