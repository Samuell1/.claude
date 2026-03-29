import type { PreToolUseHookInput, HookJSONOutput } from "@anthropic-ai/claude-agent-sdk";
import type { BashToolInput, Decision } from "./lib/types";
import { loadMergedSettings } from "./lib/settings";
import { parseBashPatterns, commandMatchesPattern } from "./lib/patterns";
import { decomposeCommand } from "./lib/shell";
import { rewriteCommand } from "./lib/rewrite";

function decide(
  command: string,
  settings: Record<string, any>,
): { decision: Decision | null; reason?: string } {
  if (!command?.trim()) return { decision: null };

  const perms = settings.permissions ?? {};
  const allowPatterns = parseBashPatterns(perms.allow ?? []);
  const denyPatterns = parseBashPatterns(perms.deny ?? []);
  const askPatterns = parseBashPatterns(perms.ask ?? []);

  const subCommands = decomposeCommand(command);
  if (!subCommands.length) return { decision: null };

  for (const cmd of subCommands) {
    if (commandMatchesPattern(cmd, denyPatterns)) {
      return { decision: "deny", reason: `Blocked sub-command: ${cmd}` };
    }
  }

  if (subCommands.every((cmd) => commandMatchesPattern(cmd, allowPatterns))) {
    return { decision: "allow", reason: "All sub-commands match allow patterns" };
  }

  for (const cmd of subCommands) {
    if (commandMatchesPattern(cmd, askPatterns)) {
      return { decision: "ask", reason: `Confirm sub-command: ${cmd}` };
    }
  }

  return { decision: null };
}

async function main() {
  const input = (await Bun.stdin.json()) as PreToolUseHookInput;
  if (input.tool_name !== "Bash") process.exit(0);

  const command = (input.tool_input as BashToolInput).command?.trim();
  if (!command) process.exit(0);

  // Normalize: check permissions against the rewritten command
  // so that bun patterns in allow/deny/ask lists match correctly
  const { command: normalized } = rewriteCommand(command);
  const settings = loadMergedSettings();
  const { decision, reason } = decide(normalized, settings);

  if (!decision) process.exit(0);

  const output: HookJSONOutput = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision,
      ...(reason && { permissionDecisionReason: reason }),
    },
  };

  console.log(JSON.stringify(output));
}

await main();
