import { execSync } from "child_process";
import { basename, join } from "path";
import { readFileSync } from "fs";

// ── Colors ──────────────────────────────────────────────
const orange = "\x1b[38;2;255;176;85m";
const green = "\x1b[38;2;0;175;80m";
const cyan = "\x1b[38;2;86;182;194m";
const red = "\x1b[38;2;255;85;85m";
const yellow = "\x1b[38;2;230;200;0m";
const white = "\x1b[38;2;220;220;220m";
const magenta = "\x1b[38;2;180;140;255m";
const dim = "\x1b[2m";
const rst = "\x1b[0m";

const sep = ` ${dim}│${rst} `;

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
const modelName: string = input.model?.display_name ?? "Claude";

const size: number = input.context_window?.context_window_size || 1000000;
const inputTokens: number = input.context_window?.current_usage?.input_tokens ?? 0;
const cacheCreate: number = input.context_window?.current_usage?.cache_creation_input_tokens ?? 0;
const cacheRead: number = input.context_window?.current_usage?.cache_read_input_tokens ?? 0;
const current = inputTokens + cacheCreate + cacheRead;
const pctUsed = size > 0 ? Math.floor((current * 100) / size) : 0;

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
} catch {}

// ── LINE 1: Model │ Context % │ Dir (branch) │ Effort ──
let line1 = `${orange}${modelName}${rst}`;
line1 += sep;
line1 += `${colorForPct(pctUsed)}${formatTokens(current)}/${formatTokens(size)} ${pctUsed}%${rst}`;
line1 += sep;
line1 += `${cyan}${dirName}${rst}`;
if (gitBranch) {
  line1 += ` ${green}(${gitBranch}${gitDirty ? `${red}${gitDirty}` : ""}${green})${rst}`;
}
if (input.worktree) {
  line1 += sep;
  line1 += `${magenta}⌥ ${input.worktree.name}${rst}`;
  if (input.worktree.original_branch) {
    line1 += `${dim} ← ${input.worktree.original_branch}${rst}`;
  }
}
line1 += sep;
switch (effort) {
  case "max":
    line1 += `${red}⬤ ${effort}${rst}`;
    break;
  case "high":
    line1 += `${magenta}● ${effort}${rst}`;
    break;
  case "medium":
    line1 += `${dim}◑ ${effort}${rst}`;
    break;
  case "low":
    line1 += `${dim}◔ ${effort}${rst}`;
    break;
  case "auto":
    line1 += `${cyan}◉ ${effort}${rst}`;
    break;
  default:
    line1 += `${dim}◑ ${effort}${rst}`;
    break;
}

// ── Rate limit lines (from input.rate_limits) ───────────
const rateLimits = input.rate_limits;
let rateLines = "";
const barWidth = 10;

if (rateLimits?.five_hour) {
  const fhPct = Math.round(rateLimits.five_hour.used_percentage ?? 0);
  const fhReset = formatResetTime(rateLimits.five_hour.resets_at, "time");
  const fhBar = buildBar(fhPct, barWidth);

  rateLines += `${white}current${rst} ${fhBar} ${colorForPct(fhPct)}${String(fhPct).padStart(3)}%${rst} ${dim}⟳${rst} ${white}${fhReset}${rst}`;

  if (rateLimits.seven_day) {
    const sdPct = Math.round(rateLimits.seven_day.used_percentage ?? 0);
    const sdReset = formatResetTime(rateLimits.seven_day.resets_at, "datetime");
    const sdBar = buildBar(sdPct, barWidth);

    rateLines += `\n${white}weekly${rst}  ${sdBar} ${colorForPct(sdPct)}${String(sdPct).padStart(3)}%${rst} ${dim}⟳${rst} ${white}${sdReset}${rst}`;
  }
}

// ── Output ──────────────────────────────────────────────
process.stdout.write(line1);
if (rateLines) {
  process.stdout.write(`\n\n${rateLines}`);
}
