# AI Agent Instructions

## General Instructions

Instructions for Claude Code, Cursor, Gemini CLI, Codex or any other coding agents:

This is a monorepo managed with Bun. Use Bun for any commands or installing new packages.

Run these commands to check your output after making code changes and fix any errors ONLY if it seems necessary. If you made a simple code change, there's no need to run these checks.

```sh
bun run format
bun run lint
bun run tsc
```

## Creating New Monorepo Packages

If you bootstrap a new folder in `apps/`, `packages/`, or `tooling/`, use the provided `[template]` folders, e.g.

```sh
apps/[template]
packages/[template]
tooling/[template]
```

And ensure any new packages like this follow the conventions of the other monorepo packages.
