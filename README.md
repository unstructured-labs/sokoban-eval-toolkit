# Unstructured Starter Repo

A Bun monorepo starter with a minimal full-stack setup: Hono + tRPC on the server, Vite + React + TanStack Query on the client, and TypeScript project references across shared packages.

## Quick Start

```sh
bun install
bun dev
```

- Server: http://localhost:3000
- Web: http://localhost:5173

## Structure

```
apps/
  server/        # Hono + tRPC API
  web/           # Vite + React client
  [template]/    # App template
packages/
  db/            # Drizzle + SQLite
  trpc-router/   # Shared tRPC router
  ui-library/    # ShadCN UI primitives
  [template]/    # Package template
tooling/
  [template]/    # Tooling template
```

## Common Commands

```sh
bun dev
bun dev:server
bun dev:web
cp .env.example .env
task env:setup
bun tsc
bun lint
bun format
```

## Docker

Build from the repo root (so the workspaces resolve):

```sh
docker build -f apps/server/Dockerfile -t starter-server .
docker build -f apps/web/Dockerfile -t starter-web .
```

## Templates

Copy any `[template]` folder when bootstrapping a new app, package, or tooling project to preserve repo conventions.
