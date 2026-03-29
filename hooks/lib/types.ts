export type BashToolInput = { command: string; description: string };
export type ParsedPattern = { prefix: string; glob: string };
export type Decision = "allow" | "deny" | "ask";
