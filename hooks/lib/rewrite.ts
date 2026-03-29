const pmReplacements: [RegExp, string][] = [
  [/^npm\s+install\b/, "bun install"],
  [/^npm\s+i\b/, "bun i"],
  [/^npm\s+ci\b/, "bun install"],
  [/^npm\s+add\b/, "bun add"],
  [/^npm\s+remove\b/, "bun remove"],
  [/^npm\s+uninstall\b/, "bun remove"],
  [/^npm\s+run\b/, "bun run"],
  [/^npm\s+test\b/, "bun test"],
  [/^npm\s+start\b/, "bun run start"],
  [/^npm\s+exec\b/, "bunx"],
  [/^npx\b/, "bunx"],
  [/^yarn\s+install\b/, "bun install"],
  [/^yarn\s+add\b/, "bun add"],
  [/^yarn\s+remove\b/, "bun remove"],
  [/^yarn\s+run\b/, "bun run"],
  [/^yarn\s+test\b/, "bun test"],
  [/^yarn\s+start\b/, "bun run start"],
  [/^yarn\s+dlx\b/, "bunx"],
  [/^yarn$/, "bun install"],
  [/^pnpm\s+install\b/, "bun install"],
  [/^pnpm\s+i\b/, "bun i"],
  [/^pnpm\s+add\b/, "bun add"],
  [/^pnpm\s+remove\b/, "bun remove"],
  [/^pnpm\s+run\b/, "bun run"],
  [/^pnpm\s+test\b/, "bun test"],
  [/^pnpm\s+start\b/, "bun run start"],
  [/^pnpm\s+dlx\b/, "bunx"],
  [/^pnpm\s+exec\b/, "bunx"],
];

export function rewriteCommand(command: string): { command: string; rewritten: boolean } {
  const parts = command.split(/(\s*(?:\||\&\&|;)\s*)/);
  let rewritten = false;

  const result = parts.map((part, i) => {
    if (i % 2 === 1) return part;
    const trimmed = part.trim();
    for (const [pattern, replacement] of pmReplacements) {
      if (pattern.test(trimmed)) {
        rewritten = true;
        return part.replace(pattern, replacement);
      }
    }
    return part;
  });

  return { command: result.join(""), rewritten };
}
