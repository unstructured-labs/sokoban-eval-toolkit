import { Button } from '@sokoban-eval-toolkit/ui-library/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@sokoban-eval-toolkit/ui-library/components/card'
import { trpc } from './trpc'

function App() {
  const hello = trpc.hello.useQuery({ name: 'World' })

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">App Template</p>
          <h1 className="text-4xl font-semibold">Full-stack Bun + tRPC + Hono</h1>
          <p className="text-slate-400">
            Vite + React + TanStack Query with TypeScript project references.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>tRPC connection</CardTitle>
            <CardDescription>Hits the server hello route for a smoke test.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              {hello.isLoading && <p className="text-slate-400">Loading...</p>}
              {hello.error && <p className="text-rose-400">Error: {hello.error.message}</p>}
              {hello.data && <p className="text-slate-100">{hello.data.message}</p>}
            </div>
            <div className="mt-4">
              <Button variant="secondary" onClick={() => hello.refetch()}>
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2">
          <Card className="bg-slate-900/40">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-slate-300">
                Frontend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400">React · Vite · TanStack Query · tRPC</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/40">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-slate-300">
                Backend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400">Hono · tRPC · Drizzle · SQLite</p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}

export default App
