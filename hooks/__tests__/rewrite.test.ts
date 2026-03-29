import { describe, test, expect } from "bun:test";
import { rewriteCommand } from "../lib/rewrite";

describe("rewriteCommand", () => {
  describe("npm → bun", () => {
    test("npm install", () => {
      const r = rewriteCommand("npm install");
      expect(r).toEqual({ command: "bun install", rewritten: true });
    });

    test("npm install <package>", () => {
      const r = rewriteCommand("npm install express");
      expect(r).toEqual({ command: "bun install express", rewritten: true });
    });

    test("npm i", () => {
      const r = rewriteCommand("npm i");
      expect(r).toEqual({ command: "bun i", rewritten: true });
    });

    test("npm ci", () => {
      const r = rewriteCommand("npm ci");
      expect(r).toEqual({ command: "bun install", rewritten: true });
    });

    test("npm add", () => {
      const r = rewriteCommand("npm add lodash");
      expect(r).toEqual({ command: "bun add lodash", rewritten: true });
    });

    test("npm remove", () => {
      const r = rewriteCommand("npm remove lodash");
      expect(r).toEqual({ command: "bun remove lodash", rewritten: true });
    });

    test("npm uninstall", () => {
      const r = rewriteCommand("npm uninstall lodash");
      expect(r).toEqual({ command: "bun remove lodash", rewritten: true });
    });

    test("npm run <script>", () => {
      const r = rewriteCommand("npm run build");
      expect(r).toEqual({ command: "bun run build", rewritten: true });
    });

    test("npm test", () => {
      const r = rewriteCommand("npm test");
      expect(r).toEqual({ command: "bun test", rewritten: true });
    });

    test("npm start", () => {
      const r = rewriteCommand("npm start");
      expect(r).toEqual({ command: "bun run start", rewritten: true });
    });

    test("npm exec", () => {
      const r = rewriteCommand("npm exec tsc");
      expect(r).toEqual({ command: "bunx tsc", rewritten: true });
    });

    test("npx", () => {
      const r = rewriteCommand("npx create-next-app");
      expect(r).toEqual({ command: "bunx create-next-app", rewritten: true });
    });
  });

  describe("yarn → bun", () => {
    test("yarn (bare)", () => {
      const r = rewriteCommand("yarn");
      expect(r).toEqual({ command: "bun install", rewritten: true });
    });

    test("yarn install", () => {
      const r = rewriteCommand("yarn install");
      expect(r).toEqual({ command: "bun install", rewritten: true });
    });

    test("yarn add", () => {
      const r = rewriteCommand("yarn add react");
      expect(r).toEqual({ command: "bun add react", rewritten: true });
    });

    test("yarn remove", () => {
      const r = rewriteCommand("yarn remove react");
      expect(r).toEqual({ command: "bun remove react", rewritten: true });
    });

    test("yarn run", () => {
      const r = rewriteCommand("yarn run dev");
      expect(r).toEqual({ command: "bun run dev", rewritten: true });
    });

    test("yarn test", () => {
      const r = rewriteCommand("yarn test");
      expect(r).toEqual({ command: "bun test", rewritten: true });
    });

    test("yarn dlx", () => {
      const r = rewriteCommand("yarn dlx create-vite");
      expect(r).toEqual({ command: "bunx create-vite", rewritten: true });
    });
  });

  describe("pnpm → bun", () => {
    test("pnpm install", () => {
      const r = rewriteCommand("pnpm install");
      expect(r).toEqual({ command: "bun install", rewritten: true });
    });

    test("pnpm i", () => {
      const r = rewriteCommand("pnpm i");
      expect(r).toEqual({ command: "bun i", rewritten: true });
    });

    test("pnpm add", () => {
      const r = rewriteCommand("pnpm add zod");
      expect(r).toEqual({ command: "bun add zod", rewritten: true });
    });

    test("pnpm remove", () => {
      const r = rewriteCommand("pnpm remove zod");
      expect(r).toEqual({ command: "bun remove zod", rewritten: true });
    });

    test("pnpm run", () => {
      const r = rewriteCommand("pnpm run lint");
      expect(r).toEqual({ command: "bun run lint", rewritten: true });
    });

    test("pnpm dlx", () => {
      const r = rewriteCommand("pnpm dlx degit");
      expect(r).toEqual({ command: "bunx degit", rewritten: true });
    });

    test("pnpm exec", () => {
      const r = rewriteCommand("pnpm exec vitest");
      expect(r).toEqual({ command: "bunx vitest", rewritten: true });
    });
  });

  describe("no-op for non-pm commands", () => {
    test("git status", () => {
      const r = rewriteCommand("git status");
      expect(r).toEqual({ command: "git status", rewritten: false });
    });

    test("ls -la", () => {
      const r = rewriteCommand("ls -la");
      expect(r).toEqual({ command: "ls -la", rewritten: false });
    });

    test("bun install (already bun)", () => {
      const r = rewriteCommand("bun install");
      expect(r).toEqual({ command: "bun install", rewritten: false });
    });
  });

  describe("compound commands", () => {
    test("npm install && npm run build", () => {
      const r = rewriteCommand("npm install && npm run build");
      expect(r.rewritten).toBe(true);
      expect(r.command).toBe("bun install && bun run build");
    });

    test("mixed: npm install | grep error", () => {
      const r = rewriteCommand("npm install | grep error");
      expect(r.rewritten).toBe(true);
      expect(r.command).toContain("bun install");
    });

    test("npm install; npm test", () => {
      const r = rewriteCommand("npm install; npm test");
      expect(r.rewritten).toBe(true);
      expect(r.command).toBe("bun install; bun test");
    });
  });
});
