import { describe, test, expect } from "bun:test";
import { decomposeCommand } from "../lib/shell";

describe("decomposeCommand", () => {
  describe("simple commands", () => {
    test("single command", () => {
      expect(decomposeCommand("ls -la")).toEqual(["ls -la"]);
    });

    test("empty string", () => {
      expect(decomposeCommand("")).toEqual([]);
    });

    test("whitespace only", () => {
      expect(decomposeCommand("   ")).toEqual([]);
    });
  });

  describe("operators", () => {
    test("&& splits into separate commands", () => {
      const result = decomposeCommand("git add . && git commit -m 'test'");
      expect(result).toContain("git add .");
      expect(result).toContain("git commit -m 'test'");
    });

    test("|| splits into separate commands", () => {
      const result = decomposeCommand("test -f file || touch file");
      expect(result).toContain("test -f file");
      expect(result).toContain("touch file");
    });

    test("; splits into separate commands", () => {
      const result = decomposeCommand("echo hello; echo world");
      expect(result).toContain("echo hello");
      expect(result).toContain("echo world");
    });

    test("pipe splits into separate commands", () => {
      const result = decomposeCommand("cat file | grep pattern");
      expect(result).toContain("cat file");
      expect(result).toContain("grep pattern");
    });
  });

  describe("subshells", () => {
    test("$() subshells are extracted", () => {
      const result = decomposeCommand("echo $(whoami)");
      expect(result).toContain("whoami");
      expect(result).toContain("echo $(whoami)");
    });

    test("nested subshells", () => {
      const result = decomposeCommand("echo $(cat $(which node))");
      expect(result).toContain("which node");
    });
  });

  describe("environment variables", () => {
    test("strips leading env var assignments", () => {
      const result = decomposeCommand("NODE_ENV=production node app.js");
      expect(result).toEqual(["node app.js"]);
    });

    test("standalone assignment is filtered out", () => {
      const result = decomposeCommand("FOO=bar");
      expect(result).toEqual([]);
    });
  });

  describe("redirections", () => {
    test("strips output redirection", () => {
      const result = decomposeCommand("echo hello > file.txt");
      expect(result).toEqual(["echo hello"]);
    });

    test("strips append redirection", () => {
      const result = decomposeCommand("echo hello >> file.txt");
      expect(result).toEqual(["echo hello"]);
    });
  });

  describe("shell keywords", () => {
    test("filters out standalone keywords", () => {
      const result = decomposeCommand("if true; then echo yes; fi");
      expect(result).toContain("echo yes");
      expect(result).not.toContain("fi");
      expect(result).not.toContain("then");
    });

    test("extracts command after keyword prefix", () => {
      const result = decomposeCommand("then echo hello");
      expect(result).toContain("echo hello");
    });
  });

  describe("quotes", () => {
    test("single-quoted strings are preserved", () => {
      const result = decomposeCommand("echo 'hello world'");
      expect(result).toEqual(["echo 'hello world'"]);
    });

    test("double-quoted strings are preserved", () => {
      const result = decomposeCommand('echo "hello world"');
      expect(result).toEqual(['echo "hello world"']);
    });

    test("operators inside quotes are not split", () => {
      const result = decomposeCommand("echo 'a && b'");
      expect(result).toEqual(["echo 'a && b'"]);
    });
  });

  describe("comments", () => {
    test("comments are ignored", () => {
      const result = decomposeCommand("# this is a comment");
      expect(result).toEqual([]);
    });
  });

  describe("complex commands", () => {
    test("multi-operator chain", () => {
      const result = decomposeCommand("mkdir -p dist && bun run build && echo done");
      expect(result).toContain("mkdir -p dist");
      expect(result).toContain("bun run build");
      expect(result).toContain("echo done");
    });

    test("whitespace normalization", () => {
      const result = decomposeCommand("ls   -la    /tmp");
      expect(result).toEqual(["ls -la /tmp"]);
    });
  });
});
