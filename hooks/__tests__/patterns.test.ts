import { describe, test, expect } from "bun:test";
import { parseBashPatterns, commandMatchesPattern } from "../lib/patterns";

describe("parseBashPatterns", () => {
  test("parses simple Bash() pattern", () => {
    const result = parseBashPatterns(["Bash(git *)"]);
    expect(result).toEqual([{ prefix: "git *", glob: "git *" }]);
  });

  test("parses pattern with colon syntax", () => {
    const result = parseBashPatterns(["Bash(git push:*)"]);
    expect(result).toEqual([{ prefix: "git push", glob: "git push *" }]);
  });

  test("parses colon with no suffix", () => {
    const result = parseBashPatterns(["Bash(docker:)"]);
    expect(result).toEqual([{ prefix: "docker", glob: "docker" }]);
  });

  test("ignores non-Bash patterns", () => {
    const result = parseBashPatterns(["Read(.env*)", "Write(.env*)"]);
    expect(result).toEqual([]);
  });

  test("parses multiple patterns", () => {
    const result = parseBashPatterns(["Bash(ls *)", "Bash(git *)", "Read(.env*)"]);
    expect(result).toHaveLength(2);
  });

  test("exact command pattern (no glob)", () => {
    const result = parseBashPatterns(["Bash(pwd)"]);
    expect(result).toEqual([{ prefix: "pwd", glob: "pwd" }]);
  });
});

describe("commandMatchesPattern", () => {
  test("exact match", () => {
    const patterns = parseBashPatterns(["Bash(pwd)"]);
    expect(commandMatchesPattern("pwd", patterns)).toBe(true);
  });

  test("glob wildcard match", () => {
    const patterns = parseBashPatterns(["Bash(git *)"]);
    expect(commandMatchesPattern("git status", patterns)).toBe(true);
    expect(commandMatchesPattern("git commit -m 'test'", patterns)).toBe(true);
  });

  test("no match", () => {
    const patterns = parseBashPatterns(["Bash(git *)"]);
    expect(commandMatchesPattern("docker ps", patterns)).toBe(false);
  });

  test("bare command matches 'cmd *' pattern", () => {
    const patterns = parseBashPatterns(["Bash(bun install *)"]);
    expect(commandMatchesPattern("bun install", patterns)).toBe(true);
  });

  test("colon syntax matches", () => {
    const patterns = parseBashPatterns(["Bash(git push:*)"]);
    expect(commandMatchesPattern("git push origin main", patterns)).toBe(true);
  });

  test("prefix match from colon syntax", () => {
    const patterns = parseBashPatterns(["Bash(git push:*)"]);
    expect(commandMatchesPattern("git push", patterns)).toBe(true);
  });

  test("wildcard in middle", () => {
    const patterns = parseBashPatterns(["Bash(*--remote*)"]);
    expect(commandMatchesPattern("wrangler deploy --remote", patterns)).toBe(true);
    expect(commandMatchesPattern("something --remote flag", patterns)).toBe(true);
  });

  test("multiple patterns, first match wins", () => {
    const patterns = parseBashPatterns(["Bash(ls *)", "Bash(git *)"]);
    expect(commandMatchesPattern("ls -la", patterns)).toBe(true);
    expect(commandMatchesPattern("git log", patterns)).toBe(true);
    expect(commandMatchesPattern("rm -rf /", patterns)).toBe(false);
  });
});
