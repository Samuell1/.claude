import type { PreToolUseHookInput, HookJSONOutput } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// --- Types ---
type BashToolInput = { command: string; description: string };
type ParsedPattern = { prefix: string; glob: string };
type Decision = "allow" | "deny" | "ask";

// --- Settings ---

function loadJSON(path: string): Record<string, any> {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function loadMergedSettings(): Record<string, any> {
  const globalPath = process.env.CLAUDE_SETTINGS_PATH ?? join(homedir(), ".claude", "settings.json");
  const settings = loadJSON(globalPath);

  const projectDir = process.env.CLAUDE_PROJECT_DIR;
  if (!projectDir) return settings;

  const projectShared = loadJSON(join(projectDir, ".claude", "settings.json"));
  const projectLocal = loadJSON(join(projectDir, ".claude", "settings.local.json"));

  const globalPerms = settings.permissions ?? {};
  const sharedPerms = projectShared.permissions ?? {};
  const localPerms = projectLocal.permissions ?? {};

  const dedup = (arr: string[]) => [...new Set(arr)];
  settings.permissions = {
    ...globalPerms,
    allow: dedup([...(globalPerms.allow ?? []), ...(sharedPerms.allow ?? []), ...(localPerms.allow ?? [])]),
    deny: dedup([...(globalPerms.deny ?? []), ...(sharedPerms.deny ?? []), ...(localPerms.deny ?? [])]),
    ask: dedup([...(globalPerms.ask ?? []), ...(sharedPerms.ask ?? []), ...(localPerms.ask ?? [])]),
  };

  return settings;
}

// --- Pattern parsing & matching ---

function parseBashPatterns(patterns: string[]): ParsedPattern[] {
  const result: ParsedPattern[] = [];
  for (const pat of patterns) {
    const m = pat.match(/^Bash\((.+)\)$/);
    if (!m) continue;
    const inner = m[1];

    const colonIdx = inner.indexOf(":");
    if (colonIdx === -1) {
      result.push({ prefix: inner, glob: inner });
    } else {
      const prefix = inner.slice(0, colonIdx);
      const suffix = inner.slice(colonIdx + 1);
      result.push({ prefix, glob: suffix ? `${prefix} ${suffix}` : prefix });
    }
  }
  return result;
}

function fnmatch(str: string, pattern: string): boolean {
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${regex}$`).test(str);
}

function commandMatchesPattern(cmd: string, patterns: ParsedPattern[]): boolean {
  for (const { prefix, glob } of patterns) {
    if (cmd === prefix) return true;
    if (fnmatch(cmd, glob)) return true;
    if (glob.endsWith(" *") && cmd === glob.slice(0, -2)) return true;
  }
  return false;
}

// --- Shell parsing helpers ---

function skipQuotedValue(cmd: string, start: number): number {
  const quote = cmd[start];
  if (quote !== '"' && quote !== "'") {
    // Unquoted: advance until whitespace, respecting $() subshells
    let i = start;
    let depth = 0;
    while (i < cmd.length) {
      if (cmd[i] === "$" && cmd[i + 1] === "(") { depth++; i += 2; continue; }
      if (cmd[i] === "(" && depth > 0) { depth++; i++; continue; }
      if (cmd[i] === ")" && depth > 0) { depth--; i++; continue; }
      if (depth > 0) { i++; continue; }
      if (/\s/.test(cmd[i])) break;
      i++;
    }
    return i;
  }
  // Quoted: advance past closing quote
  let i = start + 1;
  while (i < cmd.length && cmd[i] !== quote) {
    if (cmd[i] === "\\" && quote === '"') i++;
    i++;
  }
  return i < cmd.length ? i + 1 : i;
}

function stripRedirections(cmd: string): string {
  return cmd
    .replace(/\d*>>?\s*&?\d*\S*/g, "")
    .replace(/<<<?\s*\S+/g, "")
    .replace(/<\s*\S+/g, "")
    .trim();
}

function stripEnvVars(cmd: string): string {
  const assignRe = /^[A-Za-z_]\w*=/;
  while (assignRe.test(cmd)) {
    const eqEnd = cmd.indexOf("=") + 1;
    const valueEnd = skipQuotedValue(cmd, eqEnd);
    const rest = cmd.slice(valueEnd).trimStart();
    if (!rest) break; // standalone assignment, keep it
    cmd = rest;
  }
  return cmd;
}

const SHELL_KEYWORDS = new Set(["do", "done", "then", "else", "elif", "fi", "esac", "{", "}", "break", "continue"]);
const KEYWORD_PREFIX_RE = /^(do|then|else|elif)\s+/;
const COMPOUND_HEADER_RE = /^(for|while|until|if|case|select)\b/;

function normalize(cmd: string): string {
  cmd = cmd.trim();
  if (!cmd) return cmd;
  cmd = cmd.replace(KEYWORD_PREFIX_RE, "");
  cmd = stripEnvVars(cmd);
  cmd = stripRedirections(cmd);
  cmd = cmd.replace(/\s+/g, " ").trim();
  return cmd;
}

function isSkippable(cmd: string): boolean {
  return SHELL_KEYWORDS.has(cmd) || COMPOUND_HEADER_RE.test(cmd) || cmd.startsWith("#");
}

function isStandaloneAssignment(cmd: string): boolean {
  const m = cmd.match(/^[A-Za-z_]\w*=/);
  if (!m) return false;
  const valueEnd = skipQuotedValue(cmd, m[0].length);
  return cmd.slice(valueEnd).trim() === "";
}

// --- Command decomposition ---

function splitOnOperators(command: string): string[] {
  command = command.replace(/<<-?\s*['"]?(\w+)['"]?\n[\s\S]*?\n\1/g, "");
  command = command.replace(/\\\n/g, " ");

  const segments: string[] = [];
  let current: string[] = [];
  let currentIsEmpty = true;
  let inSingle = false, inDouble = false, parenDepth = 0;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    // Shell comments: # at start of a segment skips to end of line
    if (ch === "#" && !inSingle && !inDouble && parenDepth === 0 && currentIsEmpty) {
      while (i + 1 < command.length && command[i + 1] !== "\n") i++;
      continue;
    }

    // Backslash escaping: treat next character as literal (outside quotes)
    if (ch === "\\" && !inSingle && !inDouble && i + 1 < command.length) { current.push(ch, command[i + 1]); currentIsEmpty = false; i++; continue; }

    if (ch === "'" && !inDouble && parenDepth === 0) { inSingle = !inSingle; current.push(ch); currentIsEmpty = false; continue; }
    if (ch === '"' && !inSingle && parenDepth === 0) { inDouble = !inDouble; current.push(ch); currentIsEmpty = false; continue; }
    if (inSingle || inDouble) { current.push(ch); continue; }

    if (ch === "$" && command[i + 1] === "(") { parenDepth++; current.push("$("); currentIsEmpty = false; i++; continue; }
    if (ch === "(" && parenDepth > 0) { parenDepth++; current.push(ch); continue; }
    if (ch === ")" && parenDepth > 0) { parenDepth--; current.push(ch); continue; }
    if (parenDepth > 0) { current.push(ch); continue; }

    if (ch === "&" && command[i + 1] === "&") { segments.push(current.join("")); current = []; currentIsEmpty = true; i++; continue; }
    if (ch === "|" && command[i + 1] === "|") { segments.push(current.join("")); current = []; currentIsEmpty = true; i++; continue; }
    if (ch === ";" || ch === "|" || ch === "\n") { segments.push(current.join("")); current = []; currentIsEmpty = true; continue; }

    if (!/\s/.test(ch)) currentIsEmpty = false;
    current.push(ch);
  }
  segments.push(current.join(""));
  return segments.map(s => s.trim()).filter(Boolean);
}

function extractSubshells(command: string): string[] {
  const subs: string[] = [];
  let i = 0;
  while (i < command.length) {
    if (command[i] === "$" && command[i + 1] === "(") {
      let depth = 0, start = i + 2, j = i + 1;
      while (j < command.length) {
        if (command[j] === "(") depth++;
        else if (command[j] === ")") { depth--; if (depth === 0) { const c = command.slice(start, j); subs.push(c); subs.push(...extractSubshells(c)); break; } }
        j++;
      }
      i = j + 1;
    } else i++;
  }
  const parts = command.split("`");
  for (let idx = 1; idx < parts.length; idx += 2) {
    if (parts[idx].trim()) { subs.push(parts[idx]); subs.push(...extractSubshells(parts[idx])); }
  }
  return subs;
}

function decomposeCommand(command: string): string[] {
  const all: string[] = [];
  const segments = splitOnOperators(command);

  for (const seg of segments) {
    for (const sub of extractSubshells(seg)) {
      for (const ss of splitOnOperators(sub)) {
        const n = normalize(ss);
        if (n) all.push(n);
      }
    }
    const n = normalize(seg);
    if (n) all.push(n);
  }

  return all.filter(cmd => !isSkippable(cmd) && !isStandaloneAssignment(cmd));
}

// --- Package manager rewriting (npm/yarn/pnpm → bun) ---

const pmReplacements: [RegExp, string][] = [
  [/^npm\s+install\b/, "bun install"],
  [/^npm\s+i\b/, "bun i"],
  [/^npm\s+ci\b/, "bun install"],
  [/^npm\s+add\b/, "bun add"],
  [/^npm\s+remove\b/, "bun remove"],
  [/^npm\s+uninstall\b/, "bun remove"],
  [/^npm\s+run\b/, "bun run"],
  [/^npm\s+test\b/, "bun test"],
  [/^npm\s+start\b/, "bun run start"],
  [/^npm\s+exec\b/, "bunx"],
  [/^npx\b/, "bunx"],
  [/^yarn\s+install\b/, "bun install"],
  [/^yarn\s+add\b/, "bun add"],
  [/^yarn\s+remove\b/, "bun remove"],
  [/^yarn\s+run\b/, "bun run"],
  [/^yarn\s+test\b/, "bun test"],
  [/^yarn\s+start\b/, "bun run start"],
  [/^yarn\s+dlx\b/, "bunx"],
  [/^yarn$/, "bun install"],
  [/^pnpm\s+install\b/, "bun install"],
  [/^pnpm\s+i\b/, "bun i"],
  [/^pnpm\s+add\b/, "bun add"],
  [/^pnpm\s+remove\b/, "bun remove"],
  [/^pnpm\s+run\b/, "bun run"],
  [/^pnpm\s+test\b/, "bun test"],
  [/^pnpm\s+start\b/, "bun run start"],
  [/^pnpm\s+dlx\b/, "bunx"],
  [/^pnpm\s+exec\b/, "bunx"],
];

function rewriteCommand(command: string): { command: string; rewritten: boolean } {
  const parts = command.split(/(\s*(?:\||\&\&|;)\s*)/);
  let rewritten = false;

  const result = parts.map((part, i) => {
    if (i % 2 === 1) return part;
    const trimmed = part.trim();
    for (const [pattern, replacement] of pmReplacements) {
      if (pattern.test(trimmed)) {
        rewritten = true;
        return part.replace(pattern, replacement);
      }
    }
    return part;
  });

  return { command: result.join(""), rewritten };
}

// --- Decision logic ---

function decide(command: string, settings: Record<string, any>): { decision: Decision | null; reason?: string } {
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

  if (subCommands.every(cmd => commandMatchesPattern(cmd, allowPatterns))) {
    return { decision: "allow", reason: "All sub-commands match allow patterns" };
  }

  for (const cmd of subCommands) {
    if (commandMatchesPattern(cmd, askPatterns)) {
      return { decision: "ask", reason: `Confirm sub-command: ${cmd}` };
    }
  }

  return { decision: null };
}

// --- Output ---

function buildOutput(decision: Decision, reason: string | undefined, rewritten: boolean, rewrittenCmd: string): HookJSONOutput {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision,
      ...(reason && { permissionDecisionReason: reason }),
      ...(rewritten && { updatedInput: { command: rewrittenCmd } }),
    },
  };
}

// --- Entry point ---

async function main() {
  const input = (await Bun.stdin.json()) as PreToolUseHookInput;
  if (input.tool_name !== "Bash") process.exit(0);

  const command = (input.tool_input as BashToolInput).command?.trim();
  if (!command) process.exit(0);

  const { command: rewrittenCmd, rewritten } = rewriteCommand(command);
  const settings = loadMergedSettings();
  const { decision, reason } = decide(rewritten ? rewrittenCmd : command, settings);

  if (decision) {
    console.log(JSON.stringify(buildOutput(decision, reason, rewritten, rewrittenCmd)));
  } else if (rewritten) {
    console.log(JSON.stringify(buildOutput("ask", undefined, rewritten, rewrittenCmd)));
  }
}

await main();
