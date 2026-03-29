const SHELL_KEYWORDS = new Set([
  "do", "done", "then", "else", "elif", "fi", "esac", "{", "}", "break", "continue",
]);
const KEYWORD_PREFIX_RE = /^(do|then|else|elif)\s+/;
const COMPOUND_HEADER_RE = /^(for|while|until|if|case|select)\b/;

export function skipQuotedValue(cmd: string, start: number): number {
  const quote = cmd[start];
  if (quote !== '"' && quote !== "'") {
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
    if (!rest) break;
    cmd = rest;
  }
  return cmd;
}

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

function splitOnOperators(command: string): string[] {
  command = command.replace(/<<-?\s*['"]?(\w+)['"]?\n[\s\S]*?\n\1/g, "");
  command = command.replace(/\\\n/g, " ");

  const segments: string[] = [];
  let current: string[] = [];
  let currentIsEmpty = true;
  let inSingle = false, inDouble = false, parenDepth = 0;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    if (ch === "#" && !inSingle && !inDouble && parenDepth === 0 && currentIsEmpty) {
      while (i + 1 < command.length && command[i + 1] !== "\n") i++;
      continue;
    }

    if (ch === "\\" && !inSingle && !inDouble && i + 1 < command.length) {
      current.push(ch, command[i + 1]); currentIsEmpty = false; i++; continue;
    }

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
        else if (command[j] === ")") {
          depth--;
          if (depth === 0) {
            const c = command.slice(start, j);
            subs.push(c);
            subs.push(...extractSubshells(c));
            break;
          }
        }
        j++;
      }
      i = j + 1;
    } else i++;
  }
  const parts = command.split("`");
  for (let idx = 1; idx < parts.length; idx += 2) {
    if (parts[idx].trim()) {
      subs.push(parts[idx]);
      subs.push(...extractSubshells(parts[idx]));
    }
  }
  return subs;
}

export function decomposeCommand(command: string): string[] {
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
