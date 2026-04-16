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
  input: string,
): Promise<{ stdout: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", "run", join(HOOKS_DIR, "pre-bash.ts")], {
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

describe("pre-bash hook: tool hints (prefer Claude tools)", () => {
  describe("denies simple shell commands that have Claude equivalents", () => {
    test("cat", async () => {
      const { stdout } = await runHook(hookInput("cat README.md"));
      const out = parseOutput(stdout);
      expect(out.permissionDecision).toBe("deny");
      expect(out.permissionDecisionReason).toContain("Read tool");
    });

    test("head", async () => {
      const { stdout } = await runHook(hookInput("head -n 20 file.txt"));
      const out = parseOutput(stdout);
      expect(out.permissionDecision).toBe("deny");
      expect(out.permissionDecisionReason).toContain("Read tool");
    });

    test("tail", async () => {
      const { stdout } = await runHook(hookInput("tail -n 50 log.txt"));
      const out = parseOutput(stdout);
      expect(out.permissionDecision).toBe("deny");
      expect(out.permissionDecisionReason).toContain("Read tool");
    });

    test("grep", async () => {
      const { stdout } = await runHook(hookInput("grep -r TODO src/"));
      const out = parseOutput(stdout);
      expect(out.permissionDecision).toBe("deny");
      expect(out.permissionDecisionReason).toContain("Grep tool");
    });

    test("rg", async () => {
      const { stdout } = await runHook(hookInput("rg pattern file.ts"));
      const out = parseOutput(stdout);
      expect(out.permissionDecision).toBe("deny");
      expect(out.permissionDecisionReason).toContain("Grep tool");
    });

    test("find", async () => {
      const { stdout } = await runHook(hookInput("find . -name '*.ts'"));
      const out = parseOutput(stdout);
      expect(out.permissionDecision).toBe("deny");
      expect(out.permissionDecisionReason).toContain("Glob tool");
    });

    test("sed", async () => {
      const { stdout } = await runHook(hookInput("sed -i 's/foo/bar/g' file.txt"));
      const out = parseOutput(stdout);
      expect(out.permissionDecision).toBe("deny");
      expect(out.permissionDecisionReason).toContain("Edit tool");
    });

    test("awk", async () => {
      const { stdout } = await runHook(hookInput("awk '{print $1}' file.txt"));
      const out = parseOutput(stdout);
      expect(out.permissionDecision).toBe("deny");
      expect(out.permissionDecisionReason).toContain("Edit tool");
    });
  });

  describe("passes complex/piped usage through to permissions", () => {
    test("cat with pipe is not blocked by tool hint", async () => {
      const { stdout } = await runHook(hookInput("cat file.log | grep error"));
      if (stdout) {
        const out = parseOutput(stdout);
        expect(out.permissionDecisionReason ?? "").not.toContain("Read tool");
      }
    });

    test("find with -exec is not blocked by tool hint", async () => {
      const { stdout } = await runHook(hookInput("find . -name '*.tmp' -exec rm {} ;"));
      if (stdout) {
        const out = parseOutput(stdout);
        expect(out.permissionDecisionReason ?? "").not.toContain("Glob tool");
      }
    });

    test("subshell cat is not blocked by tool hint", async () => {
      const { stdout } = await runHook(hookInput("cat $(find . -name config.json)"));
      if (stdout) {
        const out = parseOutput(stdout);
        expect(out.permissionDecisionReason ?? "").not.toContain("Read tool");
      }
    });
  });
});

describe("pre-bash hook: package manager rewrites", () => {
  test("rewrites npm install to bun install", async () => {
    const { stdout } = await runHook(hookInput("npm install express"));
    const out = parseOutput(stdout);
    expect(out.updatedInput.command).toBe("bun install express");
  });

  test("rewrites yarn add to bun add", async () => {
    const { stdout } = await runHook(hookInput("yarn add react"));
    const out = parseOutput(stdout);
    expect(out.updatedInput.command).toBe("bun add react");
  });

  test("rewrites pnpm run to bun run", async () => {
    const { stdout } = await runHook(hookInput("pnpm run dev"));
    const out = parseOutput(stdout);
    expect(out.updatedInput.command).toBe("bun run dev");
  });

  test("does not rewrite non-pm command", async () => {
    const { stdout } = await runHook(hookInput("git status"));
    const out = parseOutput(stdout);
    expect(out.updatedInput).toBeUndefined();
  });

  test("does not rewrite already-bun command", async () => {
    const { stdout } = await runHook(hookInput("bun install"));
    const out = parseOutput(stdout);
    expect(out.updatedInput).toBeUndefined();
  });

  test("rewrite plus permission decision are emitted together", async () => {
    const { stdout } = await runHook(hookInput("npm install express"));
    const out = parseOutput(stdout);
    expect(out.updatedInput.command).toBe("bun install express");
    expect(out.permissionDecision).toBe("allow");
  });
});

describe("pre-bash hook: permission decisions", () => {
  test("allows whitelisted command", async () => {
    const { stdout } = await runHook(hookInput("git status"));
    const out = parseOutput(stdout);
    expect(out.permissionDecision).toBe("allow");
  });

  test("denies blocked command", async () => {
    const { stdout } = await runHook(hookInput("sudo rm -rf /"));
    const out = parseOutput(stdout);
    expect(out.permissionDecision).toBe("deny");
  });

  test("asks for confirm-listed command", async () => {
    const { stdout } = await runHook(hookInput("rm -rf node_modules"));
    const out = parseOutput(stdout);
    expect(out.permissionDecision).toBe("ask");
  });

  test("allows npm install after internal rewrite to bun", async () => {
    const { stdout } = await runHook(hookInput("npm install"));
    const out = parseOutput(stdout);
    expect(out.permissionDecision).toBe("allow");
  });

  test("no output for unmatched command", async () => {
    const { stdout, exitCode } = await runHook(hookInput("some-unknown-binary"));
    expect(stdout).toBe("");
    expect(exitCode).toBe(0);
  });

  test("denies force push", async () => {
    const { stdout } = await runHook(hookInput("git push --force origin main"));
    const out = parseOutput(stdout);
    expect(out.permissionDecision).toBe("deny");
  });

  test("allows compound command when all parts are allowed", async () => {
    const { stdout } = await runHook(hookInput("git status && git diff"));
    const out = parseOutput(stdout);
    expect(out.permissionDecision).toBe("allow");
  });

  test("denies compound command when any part is denied", async () => {
    const { stdout } = await runHook(hookInput("git status && sudo rm -rf /"));
    const out = parseOutput(stdout);
    expect(out.permissionDecision).toBe("deny");
  });
});

describe("pre-bash hook: non-Bash tools", () => {
  test("exits silently for Read tool", async () => {
    const { stdout, exitCode } = await runHook(
      JSON.stringify({ tool_name: "Read", tool_input: { file_path: "/tmp/x" } }),
    );
    expect(stdout).toBe("");
    expect(exitCode).toBe(0);
  });

  test("exits silently for Write tool", async () => {
    const { stdout, exitCode } = await runHook(
      JSON.stringify({ tool_name: "Write", tool_input: { file_path: "/tmp/x" } }),
    );
    expect(stdout).toBe("");
    expect(exitCode).toBe(0);
  });
});
