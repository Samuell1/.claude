import type { ParsedPattern } from "./types";

export function parseBashPatterns(patterns: string[]): ParsedPattern[] {
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

export function commandMatchesPattern(cmd: string, patterns: ParsedPattern[]): boolean {
  for (const { prefix, glob } of patterns) {
    if (cmd === prefix) return true;
    if (fnmatch(cmd, glob)) return true;
    if (glob.endsWith(" *") && cmd === glob.slice(0, -2)) return true;
  }
  return false;
}
