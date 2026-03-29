import { describe, test, expect } from "bun:test";
import { join } from "path";

const HOOKS_DIR = join(import.meta.dir, "..");

function hookInput(command: string, toolName = "Bash") {
  return JSON.stringify({
    tool_name: toolName,
    tool_input: { command },
  });
}

async function runHook(
  script: string,
  input: string,
): Promise<{ stdout: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", "run", join(HOOKS_DIR, script)], {
    stdin: new Response(input),
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      CLAUDE_SETTINGS_PATH: join(import.meta.dir, "fixtures", "settings.json"),
      CLAUDE_PROJECT_DIR: undefined,
    },
  });

  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), exitCode };
}

function parseOutput(stdout: string) {
  return JSON.parse(stdout).hookSpecificOutput;
}

// --- rewrite-pm.ts ---

describe("rewrite-pm.ts hook", () => {
  test("rewrites npm install to bun install", async () => {
    const { stdout } = await runHook("rewrite-pm.ts", hookInput("npm install express"));
    const out = parseOutput(stdout);
    expect(out.updatedInput.command).toBe("bun install express");
    expect(out.permissionDecision).toBeUndefined();
  });

  test("rewrites yarn add to bun add", async () => {
    const { stdout } = await runHook("rewrite-pm.ts", hookInput("yarn add react"));
    const out = parseOutput(stdout);
    expect(out.updatedInput.command).toBe("bun add react");
  });

  test("rewrites pnpm run to bun run", async () => {
    const { stdout } = await runHook("rewrite-pm.ts", hookInput("pnpm run dev"));
    const out = parseOutput(stdout);
    expect(out.updatedInput.command).toBe("bun run dev");
  });

  test("no output for non-pm command", async () => {
    const { stdout, exitCode } = await runHook("rewrite-pm.ts", hookInput("git status"));
    expect(stdout).toBe("");
    expect(exitCode).toBe(0);
  });

  test("no output for already-bun command", async () => {
    const { stdout, exitCode } = await runHook("rewrite-pm.ts", hookInput("bun install"));
    expect(stdout).toBe("");
    expect(exitCode).toBe(0);
  });

  test("exits silently for non-Bash tool", async () => {
    const { stdout, exitCode } = await runHook(
      "rewrite-pm.ts",
      JSON.stringify({ tool_name: "Read", tool_input: { file_path: "/tmp/x" } }),
    );
    expect(stdout).toBe("");
    expect(exitCode).toBe(0);
  });
});

// --- permissions.ts ---

describe("permissions.ts hook", () => {
  test("allows whitelisted command", async () => {
    const { stdout } = await runHook("permissions.ts", hookInput("git status"));
    const out = parseOutput(stdout);
    expect(out.permissionDecision).toBe("allow");
  });

  test("denies blocked command", async () => {
    const { stdout } = await runHook("permissions.ts", hookInput("sudo rm -rf /"));
    const out = parseOutput(stdout);
    expect(out.permissionDecision).toBe("deny");
  });

  test("asks for confirm-listed command", async () => {
    const { stdout } = await runHook("permissions.ts", hookInput("rm -rf node_modules"));
    const out = parseOutput(stdout);
    expect(out.permissionDecision).toBe("ask");
  });

  test("allows npm install after internal rewrite to bun", async () => {
    const { stdout } = await runHook("permissions.ts", hookInput("npm install"));
    const out = parseOutput(stdout);
    expect(out.permissionDecision).toBe("allow");
  });

  test("no output for unmatched command", async () => {
    const { stdout, exitCode } = await runHook("permissions.ts", hookInput("some-unknown-binary"));
    expect(stdout).toBe("");
    expect(exitCode).toBe(0);
  });

  test("exits silently for non-Bash tool", async () => {
    const { stdout, exitCode } = await runHook(
      "permissions.ts",
      JSON.stringify({ tool_name: "Write", tool_input: { file_path: "/tmp/x" } }),
    );
    expect(stdout).toBe("");
    expect(exitCode).toBe(0);
  });

  test("denies force push", async () => {
    const { stdout } = await runHook("permissions.ts", hookInput("git push --force origin main"));
    const out = parseOutput(stdout);
    expect(out.permissionDecision).toBe("deny");
  });

  test("allows compound command when all parts are allowed", async () => {
    const { stdout } = await runHook("permissions.ts", hookInput("git status && git diff"));
    const out = parseOutput(stdout);
    expect(out.permissionDecision).toBe("allow");
  });

  test("denies compound command when any part is denied", async () => {
    const { stdout } = await runHook("permissions.ts", hookInput("git status && sudo rm -rf /"));
    const out = parseOutput(stdout);
    expect(out.permissionDecision).toBe("deny");
  });
});
