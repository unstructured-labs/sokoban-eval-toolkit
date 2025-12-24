import { db, users } from '@sokoban-eval-toolkit/db'
import { initTRPC } from '@trpc/server'
import { z } from 'zod'

const t = initTRPC.create()

export const appRouter = t.router({
  hello: t.procedure.input(z.object({ name: z.string() })).query(({ input }) => {
    return {
      message: `Hello, ${input.name}! Welcome to the starter monorepo.`,
    }
  }),

  users: {
    list: t.procedure.query(async () => {
      return await db.select().from(users)
    }),

    create: t.procedure
      .input(
        z.object({
          name: z.string().min(1),
          email: z.string().email(),
        }),
      )
      .mutation(async ({ input }) => {
        const [user] = await db.insert(users).values(input).returning()
        return user
      }),
  },
})

export type AppRouter = typeof appRouter
