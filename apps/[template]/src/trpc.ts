import type { AppRouter } from '@sokoban-eval-toolkit/trpc-router'
import { type CreateTRPCReact, createTRPCReact } from '@trpc/react-query'

export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>()
