# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An interactive CLI that boots throwaway PostgreSQL/MySQL Docker containers and drops the user into the engine's native client (`psql`/`mysql`). TypeScript run directly via `tsx` — there is no build step.

## Commands

- `npm start` — run the CLI (`tsx src/index.ts`).
- `npm run typecheck` — `tsc --noEmit`. There is no linter, no test runner, and no `dist/` output.

Requires Docker to be running; `index.ts` checks `docker info` at startup and exits if it fails.

## Architecture

**Single extension point: `ENGINES` in `src/docker.ts`.** Adding/changing engines means editing this record — `containerName`, `image`, `hostPort`, env vars, `readyCheck` command (run inside the container via `docker exec`), `clientCmd` (the interactive client to exec), and optional `clientEnv` (e.g. MySQL needs `MYSQL_PWD` passed via `-e` because `mysql -p` would prompt). `menu.ts`, `state.ts`, and `index.ts` all key off `Engine = "postgres" | "mysql"`, so a new engine also needs that union widened plus a menu entry.

**Two Docker invocation modes in `docker.ts`:**
- `dockerCapture(args)` — silent, returns `{code, stdout, stderr}`. Used for everything programmatic (start, ready-check, logs, cleanup).
- `dockerAttach(args)` — `stdio: "inherit"`, gives the spawned process the real TTY. Used only by `attachInteractive` for the SQL client.

Don't mix them — capturing the client breaks interactivity; attaching the ready-check loses the exit code.

**State is a single mutable module-level object** (`src/state.ts`). `state.engine` tracks the currently-running container; switching engines in `chooseEngine` stops the previous one before starting the new one.

**Lifecycle is bracketed by `cleanupAll()`:** called once at startup (in case a prior crashed run left containers) and once on shutdown. SIGINT/SIGTERM are wired to `shutdown()` in `index.ts`, which guards against re-entry — a second Ctrl+C exits immediately with 130.

**Inquirer `ExitPromptError`** is thrown when the user hits Ctrl+C inside a `select` prompt. `isExitPromptError` in `index.ts` detects it (by `err.name` or message regex) and treats it as "quit" at the top menu or "back" inside a sub-menu. Any new prompt sites need the same handling or they'll surface as unhandled errors.

## TypeScript / module conventions

- ESM (`"type": "module"`) with `moduleResolution: "NodeNext"`. **Relative imports must use the `.js` extension** even though source files are `.ts` (e.g. `import { state } from "./state.js"`). This is not optional under NodeNext.
- `strict` plus `noUncheckedIndexedAccess` are on — array/record lookups return `T | undefined`.
- `tsconfig.json` has `noEmit: true`; typecheck only.
