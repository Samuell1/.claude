import { describe, test, expect } from "bun:test";
import { join } from "path";

const HOOKS_DIR = join(import.meta.dir, "..");

function hookInput(command: string) {
  return JSON.stringify({ tool_name: "Bash", tool_input: { command } });
}

async function runHook(input: string): Promise<{ stdout: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", "run", join(HOOKS_DIR, "prefer-tools.ts")], {
    stdin: new Response(input),
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), exitCode };
}

function parseOutput(stdout: string) {
  return JSON.parse(stdout).hookSpecificOutput;
}

describe("prefer-tools hook", () => {
  describe("denies simple shell commands", () => {
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

  describe("allows complex/piped usage", () => {
    test("cat with pipe", async () => {
      const { stdout, exitCode } = await runHook(hookInput("cat file.log | grep error"));
      expect(stdout).toBe("");
      expect(exitCode).toBe(0);
    });

    test("grep in pipeline", async () => {
      const { stdout, exitCode } = await runHook(hookInput("ps aux | grep node"));
      expect(stdout).toBe("");
      expect(exitCode).toBe(0);
    });

    test("find with -exec", async () => {
      const { stdout, exitCode } = await runHook(hookInput("find . -name '*.tmp' -exec rm {} ;"));
      expect(stdout).toBe("");
      expect(exitCode).toBe(0);
    });

    test("command with &&", async () => {
      const { stdout, exitCode } = await runHook(hookInput("grep -r TODO && echo found"));
      expect(stdout).toBe("");
      expect(exitCode).toBe(0);
    });

    test("command with redirection", async () => {
      const { stdout, exitCode } = await runHook(hookInput("grep error log.txt > errors.txt"));
      expect(stdout).toBe("");
      expect(exitCode).toBe(0);
    });

    test("command with subshell", async () => {
      const { stdout, exitCode } = await runHook(hookInput("cat $(find . -name config.json)"));
      expect(stdout).toBe("");
      expect(exitCode).toBe(0);
    });
  });

  describe("ignores unrelated commands", () => {
    test("git status", async () => {
      const { stdout, exitCode } = await runHook(hookInput("git status"));
      expect(stdout).toBe("");
      expect(exitCode).toBe(0);
    });

    test("bun install", async () => {
      const { stdout, exitCode } = await runHook(hookInput("bun install"));
      expect(stdout).toBe("");
      expect(exitCode).toBe(0);
    });

    test("ls -la", async () => {
      const { stdout, exitCode } = await runHook(hookInput("ls -la"));
      expect(stdout).toBe("");
      expect(exitCode).toBe(0);
    });
  });

  describe("ignores non-Bash tools", () => {
    test("Read tool", async () => {
      const input = JSON.stringify({ tool_name: "Read", tool_input: { file_path: "/tmp/x" } });
      const { stdout, exitCode } = await runHook(input);
      expect(stdout).toBe("");
      expect(exitCode).toBe(0);
    });
  });
});
