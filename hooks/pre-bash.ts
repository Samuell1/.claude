import type { PreToolUseHookInput, HookJSONOutput } from "@anthropic-ai/claude-agent-sdk";
import type { BashToolInput, Decision } from "./lib/types";
import { loadMergedSettings } from "./lib/settings";
import { parseBashPatterns, commandMatchesPattern } from "./lib/patterns";
import { decomposeCommand } from "./lib/shell";
import { rewriteCommand } from "./lib/rewrite";

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
  return !/[|;&<>]|\$\(|`/.test(command);
}

function getBaseCommand(command: string): string {
  return command.trimStart().split(/\s/)[0];
}

function checkPreferTools(command: string): string | null {
  const base = getBaseCommand(command);
  const hint = TOOL_HINTS[base];
  if (!hint || !isSimpleUsage(command)) return null;
  return hint;
}

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

  const hint = checkPreferTools(command);
  if (hint) {
    const output: HookJSONOutput = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: hint,
      },
    };
    console.log(JSON.stringify(output));
    return;
  }

  const { command: rewrittenCmd, rewritten } = rewriteCommand(command);

  const settings = loadMergedSettings();
  const { decision, reason } = decide(rewrittenCmd, settings);

  if (!rewritten && !decision) process.exit(0);

  const output: HookJSONOutput = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      ...(rewritten && { updatedInput: { command: rewrittenCmd } }),
      ...(decision && { permissionDecision: decision }),
      ...(decision && reason && { permissionDecisionReason: reason }),
    },
  };

  console.log(JSON.stringify(output));
}

await main();
