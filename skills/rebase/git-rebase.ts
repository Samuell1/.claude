#!/usr/bin/env bun

import { writeFileSync, unlinkSync, copyFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { spawnSync } from "child_process";

const baseRef = process.argv[2];
if (!baseRef) {
  console.error("Usage: bun run git-rebase.ts <base-ref> << 'EOF'\n<todo>\nEOF");
  process.exit(1);
}

// Read todo from stdin
const todo = await new Response(Bun.stdin.stream()).text();
if (!todo.trim()) {
  console.error("Error: empty todo list. Provide rebase instructions via stdin.");
  process.exit(1);
}

// Write todo to a temp file
const todoPath = join(tmpdir(), `claude-rebase-todo-${Date.now()}.txt`);
writeFileSync(todoPath, todo.trim() + "\n");

// Use a small bun inline script as the sequence editor.
// Git calls: $GIT_SEQUENCE_EDITOR <rebase-todo-file>
// Our editor copies our pre-built todo over it.
const editorScript = join(tmpdir(), `claude-rebase-editor-${Date.now()}.ts`);
writeFileSync(
  editorScript,
  `import { copyFileSync } from "fs"; copyFileSync(${JSON.stringify(todoPath)}, process.argv[2]);`,
);

const editorCmd = `bun run "${editorScript}"`;

const result = spawnSync("git", ["rebase", "-i", baseRef], {
  env: { ...process.env, GIT_SEQUENCE_EDITOR: editorCmd },
  stdio: "inherit",
});

// Cleanup temp files
try { unlinkSync(todoPath); } catch {}
try { unlinkSync(editorScript); } catch {}

process.exit(result.status ?? 1);
