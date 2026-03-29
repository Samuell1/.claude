import { execSync } from "child_process";
import { basename, join } from "path";
import { readFileSync, statSync } from "fs";

// ── Colors ──────────────────────────────────────────────
const orange = "\x1b[38;2;255;176;85m";
const green = "\x1b[38;2;0;175;80m";
const cyan = "\x1b[38;2;86;182;194m";
const red = "\x1b[38;2;255;85;85m";
const yellow = "\x1b[38;2;230;200;0m";
const white = "\x1b[38;2;220;220;220m";
const magenta = "\x1b[38;2;180;140;255m";
const blue = "\x1b[38;2;100;149;237m";
const gray = "\x1b[38;2;140;140;140m";
const dim = "\x1b[2m";
const rst = "\x1b[0m";

const sep = ` ${gray}·${rst} `;

// ── Helpers ─────────────────────────────────────────────
function formatTokens(num: number): string {
  if (num >= 1_000_000) {
    const val = num / 1_000_000;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + "M";
  }
  if (num >= 1000) return Math.floor(num / 1000) + "k";
  return String(num);
}

function colorForPct(pct: number): string {
  if (pct >= 90) return red;
  if (pct >= 70) return yellow;
  if (pct >= 50) return orange;
  return green;
}

function mutedColorForPct(pct: number): string {
  if (pct >= 80) return red;
  if (pct >= 70) return "\x1b[38;2;170;150;50m";
  if (pct >= 50) return "\x1b[38;2;180;135;75m";
  return "\x1b[38;2;60;135;75m";
}

function buildBar(pct: number, width: number): string {
  pct = Math.max(0, Math.min(100, pct));
  const filled = Math.round((pct * width) / 100);
  const empty = width - filled;
  return `${colorForPct(pct)}${"●".repeat(filled)}${dim}${"○".repeat(empty)}${rst}`;
}

function formatResetTime(
  value: string | number | undefined | null,
  style: "time" | "datetime" | "date" = "date",
): string {
  if (value == null || value === "null") return "";
  // Unix epoch seconds (number) or ISO string
  const d = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (isNaN(d.getTime())) return "";

  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  const timeStr = `${h12}:${m.toString().padStart(2, "0")}${ampm}`;

  switch (style) {
    case "time":
      return timeStr;
    case "datetime":
      return `${months[d.getMonth()]} ${d.getDate()}, ${timeStr}`;
    default:
      return `${months[d.getMonth()]} ${d.getDate()}`;
  }
}

// ── Read input ──────────────────────────────────────────
let input: any;
try {
  input = await Bun.stdin.json();
} catch {
  process.stdout.write("Claude");
  process.exit(0);
}

if (!input) {
  process.stdout.write("Claude");
  process.exit(0);
}


// ── Extract JSON data ───────────────────────────────────
const modelName: string = (input.model?.display_name ?? "Claude").replace(/\s*\(.*?\)/, "");

const size: number = input.context_window?.context_window_size || 1000000;
const inputTokens: number = input.context_window?.current_usage?.input_tokens ?? 0;
const cacheCreate: number = input.context_window?.current_usage?.cache_creation_input_tokens ?? 0;
const cacheRead: number = input.context_window?.current_usage?.cache_read_input_tokens ?? 0;
const current = inputTokens + cacheCreate + cacheRead;
const pctUsed = size > 0 ? Math.floor((current * 100) / size) : 0;

// ── Session duration (from transcript file birth time) ──
let sessionDuration = "";
try {
  const transcriptPath: string = input.transcript_path ?? "";
  if (transcriptPath) {
    const birthMs = statSync(transcriptPath).birthtimeMs;
    const elapsedMs = Date.now() - birthMs;
    const totalSec = Math.floor(elapsedMs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    if (h > 0) sessionDuration = `${h}h${m > 0 ? `${m}m` : ""}`;
    else if (m > 0) sessionDuration = `${m}m`;
    else sessionDuration = "<1m";
  }
} catch {}

// Read effort from settings
let effort: string = input.effort_level ?? "default";
if (effort === "default") {
  try {
    const settings = JSON.parse(
      readFileSync(join(process.env.HOME!, ".claude", "settings.json"), "utf8"),
    );
    effort = settings.effortLevel ?? "default";
  } catch {}
}

// ── Git info ────────────────────────────────────────────
const cwd: string = input.cwd ?? input.workspace?.current_dir ?? process.cwd();
const dirName = basename(cwd);

let gitBranch = "";
let gitDirty = "";
let gitAdditions = 0;
let gitDeletions = 0;
let gitAhead = 0;
let gitBehind = 0;
try {
  execSync(`git -C "${cwd}" rev-parse --is-inside-work-tree`, {
    stdio: ["pipe", "pipe", "ignore"],
  });
  gitBranch = execSync(`git -C "${cwd}" symbolic-ref --short HEAD`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "ignore"],
  }).trim();
  const porcelain = execSync(`git -C "${cwd}" status --porcelain`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "ignore"],
  }).trim();
  if (porcelain) gitDirty = "*";
  // Ahead/behind remote
  try {
    const abRaw = execSync(`git -C "${cwd}" rev-list --left-right --count @{upstream}...HEAD`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    const [behind, ahead] = abRaw.split(/\s+/).map(Number);
    if (!isNaN(ahead)) gitAhead = ahead;
    if (!isNaN(behind)) gitBehind = behind;
  } catch {}
  // Sum additions/deletions for all changes vs HEAD (staged + unstaged).
  // Falls back to staged-only diff for repos with no commits yet.
  let numstatRaw = "";
  try {
    numstatRaw = execSync(`git -C "${cwd}" diff HEAD --numstat`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {}
  if (!numstatRaw) {
    try {
      numstatRaw = execSync(`git -C "${cwd}" diff --cached --numstat`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      }).trim();
    } catch {}
  }
  for (const line of numstatRaw.split("\n")) {
    const parts = line.split("\t");
    if (parts.length >= 2) {
      const adds = parseInt(parts[0], 10);
      const dels = parseInt(parts[1], 10);
      if (!isNaN(adds)) gitAdditions += adds;
      if (!isNaN(dels)) gitDeletions += dels;
    }
  }
} catch {}

// ── LINE 1: Dir (branch) │ Context % │ Model │ Effort ──
let line1 = `${cyan}${dirName}${rst}`;
if (input.worktree) {
  line1 += ` ${magenta}⧉ ${input.worktree.name}${rst}`;
  if (input.worktree.original_branch) {
    line1 += `${dim} ← ${input.worktree.original_branch}${rst}`;
  }
} else if (gitBranch) {
  line1 += ` ${blue}⎇ ${gitBranch}${rst}`;
}
if (gitAdditions > 0 || gitDeletions > 0) {
  if (gitAdditions > 0) line1 += ` ${green}+${gitAdditions}${rst}`;
  if (gitDeletions > 0) line1 += ` ${red}-${gitDeletions}${rst}`;
}
if (gitAhead > 0 || gitBehind > 0) {
  if (gitAhead > 0) line1 += ` ${green}↑${gitAhead}${rst}`;
  if (gitBehind > 0) line1 += ` ${yellow}↓${gitBehind}${rst}`;
}
line1 += sep;
line1 += `${colorForPct(pctUsed)}${formatTokens(current)}/${formatTokens(size)} ${pctUsed}%${rst}`;
if (current > 256_000) {
  line1 += ` ${red}⚠${rst}`;
}
line1 += sep;
line1 += `${orange}${modelName} ${gray}(${effort})${rst}`;
if (sessionDuration) {
  line1 += sep;
  line1 += `${gray}${sessionDuration}${rst}`;
}

// ── Rate limit line (from input.rate_limits) ────────────
const rateLimits = input.rate_limits;
let rateLine = "";

if (rateLimits?.five_hour) {
  const fhPct = Math.round(rateLimits.five_hour.used_percentage ?? 0);
  const sdPct = rateLimits.seven_day ? Math.round(rateLimits.seven_day.used_percentage ?? 0) : 0;

  if (fhPct >= 10 || sdPct >= 10) {
    const fhReset = formatResetTime(rateLimits.five_hour.resets_at, "time");
    rateLine += `${gray}5h:${rst} ${mutedColorForPct(fhPct)}${fhPct}%${rst} ${gray}⟳ ${fhReset}${rst}`;

    if (rateLimits.seven_day) {
      const sdReset = formatResetTime(rateLimits.seven_day.resets_at, "datetime");
      rateLine += `${sep}${gray}7d:${rst} ${mutedColorForPct(sdPct)}${sdPct}%${rst} ${gray}⟳ ${sdReset}${rst}`;
    }
  }
}


// ── Output ──────────────────────────────────────────────
process.stdout.write(line1);
if (rateLine) {
  process.stdout.write(`\n${rateLine}`);
}
