import { trpcServer } from '@hono/trpc-server'
import { appRouter } from '@sokoban-eval-toolkit/trpc-router'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// Enable CORS for frontend
app.use('/*', cors())

// tRPC endpoint
app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
  }),
)

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    message: 'Starter monorepo backend is running',
  })
})

const port = 3000
console.log(`Server running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}
