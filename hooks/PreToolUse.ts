import type { PreToolUseHookInput, HookJSONOutput } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// --- Types ---
type BashToolInput = { command: string; description: string };
type ParsedPattern = { prefix: string; glob: string };
type Decision = "allow" | "deny" | "ask";

// --- Load & merge settings from all layers ---
function loadSettings(path: string): Record<string, any> {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function loadMergedSettings(): Record<string, any> {
  const globalPath = process.env.CLAUDE_SETTINGS_PATH ?? join(homedir(), ".claude", "settings.json");
  const settings = loadSettings(globalPath);

  const projectDir = process.env.CLAUDE_PROJECT_DIR;
  if (!projectDir) return settings;

  const projectShared = loadSettings(join(projectDir, ".claude", "settings.json"));
  const projectLocal = loadSettings(join(projectDir, ".claude", "settings.local.json"));

  const globalPerms = settings.permissions ?? {};
  const sharedPerms = projectShared.permissions ?? {};
  const localPerms = projectLocal.permissions ?? {};

  // Merge and deduplicate
  const dedup = (arr: string[]) => [...new Set(arr)];
  settings.permissions = {
    ...globalPerms,
    allow: dedup([...(globalPerms.allow ?? []), ...(sharedPerms.allow ?? []), ...(localPerms.allow ?? [])]),
    deny: dedup([...(globalPerms.deny ?? []), ...(sharedPerms.deny ?? []), ...(localPerms.deny ?? [])]),
    ask: dedup([...(globalPerms.ask ?? []), ...(sharedPerms.ask ?? []), ...(localPerms.ask ?? [])]),
  };

  return settings;
}

// --- Parse Bash(...) permission patterns ---
function parseBashPatterns(patterns: string[]): ParsedPattern[] {
  const result: ParsedPattern[] = [];
  for (const pat of patterns) {
    const m = pat.match(/^Bash\((.+)\)$/);
    if (!m) continue;
    const inner = m[1];

    // Handle colon syntax: Bash(git push:*) and space/wildcard: Bash(git *)
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

// --- fnmatch-style glob matching ---
function fnmatch(str: string, pattern: string): boolean {
  // Convert glob to regex: * → .*, ? → ., escape rest
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
    // "sort *" should also match bare "sort" (no args)
    if (glob.endsWith(" *") && cmd === glob.slice(0, -2)) return true;
  }
  return false;
}

// --- Strip redirections, env vars, shell keywords ---
function stripRedirections(cmd: string): string {
  return cmd
    .replace(/\d*>>?\s*&?\d*\S*/g, "")
    .replace(/<<<?\s*\S+/g, "")
    .replace(/<\s*\S+/g, "")
    .trim();
}

function stripEnvVars(cmd: string): string {
  while (/^[A-Za-z_]\w*=/.test(cmd)) {
    const m = cmd.match(/^[A-Za-z_]\w*=/);
    if (!m) break;
    // Skip past the value (quoted or unquoted)
    let i = m[0].length;
    if (cmd[i] === '"') {
      i++;
      while (i < cmd.length && cmd[i] !== '"') {
        if (cmd[i] === "\\" && i + 1 < cmd.length) i += 2;
        else i++;
      }
      if (i < cmd.length) i++;
    } else if (cmd[i] === "'") {
      i++;
      while (i < cmd.length && cmd[i] !== "'") i++;
      if (i < cmd.length) i++;
    } else {
      while (i < cmd.length && !/\s/.test(cmd[i])) i++;
    }
    const rest = cmd.slice(i).trimStart();
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

function isStructural(cmd: string): boolean {
  return SHELL_KEYWORDS.has(cmd) || COMPOUND_HEADER_RE.test(cmd);
}

function isStandaloneAssignment(cmd: string): boolean {
  const m = cmd.match(/^[A-Za-z_]\w*=/);
  if (!m) return false;
  let i = m[0].length;
  // skip value
  if (cmd[i] === '"' || cmd[i] === "'") {
    const q = cmd[i];
    i++;
    while (i < cmd.length && cmd[i] !== q) {
      if (cmd[i] === "\\" && q === '"') i++;
      i++;
    }
    if (i < cmd.length) i++;
  } else {
    let depth = 0;
    while (i < cmd.length) {
      if (cmd[i] === "$" && cmd[i + 1] === "(") { depth++; i += 2; continue; }
      if (cmd[i] === "(" && depth > 0) { depth++; i++; continue; }
      if (cmd[i] === ")" && depth > 0) { depth--; i++; continue; }
      if (depth > 0) { i++; continue; }
      if (/\s/.test(cmd[i])) break;
      i++;
    }
  }
  return cmd.slice(i).trim() === "";
}

// --- Decompose compound commands ---
function splitOnOperators(command: string): string[] {
  // Strip heredocs and collapse line continuations
  command = command.replace(/<<-?\s*['"]?(\w+)['"]?\n[\s\S]*?\n\1/g, "");
  command = command.replace(/\\\n/g, " ");

  const segments: string[] = [];
  let current: string[] = [];
  let inSingle = false, inDouble = false, parenDepth = 0;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    if (ch === "'" && !inDouble && parenDepth === 0) { inSingle = !inSingle; current.push(ch); continue; }
    if (ch === '"' && !inSingle && parenDepth === 0) { inDouble = !inDouble; current.push(ch); continue; }
    if (inSingle || inDouble) { current.push(ch); continue; }

    if (ch === "$" && command[i + 1] === "(") { parenDepth++; current.push("$("); i++; continue; }
    if (ch === "(" && parenDepth > 0) { parenDepth++; current.push(ch); continue; }
    if (ch === ")" && parenDepth > 0) { parenDepth--; current.push(ch); continue; }
    if (parenDepth > 0) { current.push(ch); continue; }

    if (ch === "&" && command[i + 1] === "&") { segments.push(current.join("")); current = []; i++; continue; }
    if (ch === "|" && command[i + 1] === "|") { segments.push(current.join("")); current = []; i++; continue; }
    if (ch === ";" || ch === "|" || ch === "\n") { segments.push(current.join("")); current = []; continue; }

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
  // Backticks
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

  return all.filter(cmd => !isStructural(cmd) && !isStandaloneAssignment(cmd));
}

// --- npm/npx/yarn/pnpm → bun rewriting ---
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

// --- Main decision logic ---
function decide(command: string, settings: Record<string, any>): { decision: Decision | null; reason?: string } {
  if (!command?.trim()) return { decision: null };

  const perms = settings.permissions ?? {};
  const allowPatterns = parseBashPatterns(perms.allow ?? []);
  const denyPatterns = parseBashPatterns(perms.deny ?? []);
  const askPatterns = parseBashPatterns(perms.ask ?? []);

  const subCommands = decomposeCommand(command);
  if (!subCommands.length) return { decision: null };

  // 1. Deny takes priority — any sub-command matching deny → block
  for (const cmd of subCommands) {
    if (commandMatchesPattern(cmd, denyPatterns)) {
      return { decision: "deny", reason: `Blocked sub-command: ${cmd}` };
    }
  }

  // 2. Allow if ALL sub-commands match allow patterns (allow beats ask)
  const allAllowed = subCommands.every(cmd => commandMatchesPattern(cmd, allowPatterns));
  if (allAllowed) {
    return { decision: "allow", reason: "All sub-commands match allow patterns" };
  }

  // 3. Ask if any sub-command matches ask patterns
  for (const cmd of subCommands) {
    if (commandMatchesPattern(cmd, askPatterns)) {
      return { decision: "ask", reason: `Confirm sub-command: ${cmd}` };
    }
  }

  // 4. Fallback: no decision — fall through to normal prompting
  return { decision: null };
}

// --- Entry point ---
const input = (await Bun.stdin.json()) as PreToolUseHookInput;

if (input.tool_name !== "Bash") process.exit(0);

const toolInput = input.tool_input as BashToolInput;
const command = toolInput.command?.trim();
if (!command) process.exit(0);

// Step 1: Rewrite npm/yarn/pnpm → bun
const { command: rewrittenCmd, rewritten } = rewriteCommand(command);
const cmd = rewritten ? rewrittenCmd : command;

// Step 2: Decide based on settings patterns
const settings = loadMergedSettings();
const { decision, reason } = decide(cmd, settings);

if (decision) {
  const output: HookJSONOutput = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision,
      ...(reason && { permissionDecisionReason: reason }),
      ...(rewritten && { updatedInput: { command: rewrittenCmd } }),
    },
  };
  console.log(JSON.stringify(output));
} else if (rewritten) {
  // No decision but command was rewritten — pass through with updated command
  const output: HookJSONOutput = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      ...(rewritten && { updatedInput: { command: rewrittenCmd } }),
    },
  };
  console.log(JSON.stringify(output));
}
