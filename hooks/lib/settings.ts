import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

function loadJSON(path: string): Record<string, any> {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

export function loadMergedSettings(): Record<string, any> {
  const globalPath =
    process.env.CLAUDE_SETTINGS_PATH ?? join(homedir(), ".claude", "settings.json");
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
    allow: dedup([
      ...(globalPerms.allow ?? []),
      ...(sharedPerms.allow ?? []),
      ...(localPerms.allow ?? []),
    ]),
    deny: dedup([
      ...(globalPerms.deny ?? []),
      ...(sharedPerms.deny ?? []),
      ...(localPerms.deny ?? []),
    ]),
    ask: dedup([
      ...(globalPerms.ask ?? []),
      ...(sharedPerms.ask ?? []),
      ...(localPerms.ask ?? []),
    ]),
  };

  return settings;
}
