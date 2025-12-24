# Sokoban Eval Toolkit

A web-based Sokoban puzzle environment for evaluating AI language models on spatial reasoning and planning tasks. Features procedural puzzle generation, an integrated BFS solver, and AI model integration via OpenRouter.

## Quick Start

```sh
bun install
bun dev
```

Open http://localhost:5173 to play.

## Features

### Puzzle Modes

- **Easy** - 8x8 grid, 2 boxes, 5-15 optimal moves
- **Medium** - 9x9 grid, 3 boxes, 10-25 optimal moves
- **Hard** - 10x10 grid, 4 boxes, 15-40 optimal moves
- **Classic** - 1000 curated puzzles from [boxoban-levels](https://github.com/google-deepmind/boxoban-levels)

### AI Integration

- Connect any LLM via OpenRouter API
- Configurable prompt formats (ASCII grid, coordinates)
- Full solution or move-by-move execution modes
- Token usage and cost tracking
- Solution replay functionality

### Built-in Solver

- BFS-based optimal solver
- Real-time "shortest solution" display during gameplay
- One-click solution playback
- Corner deadlock detection

### Controls

| Key | Action |
|-----|--------|
| Arrow Keys | Move player |
| Z / Backspace | Undo move |
| R | Reset puzzle |
| N | Generate new puzzle |

## Project Structure

```
apps/
  ui-sokoban/     # Main Sokoban game UI (Vite + React)
  server/         # Hono + tRPC API server
  web/            # Base web client
packages/
  ui-library/     # Shared UI components (ShadCN)
  utils/          # Shared utilities (OpenRouter models, etc.)
  db/             # Database schema (Drizzle + SQLite)
  trpc-router/    # Shared tRPC router definitions
```

## Environment Setup

Create a `.env` file with your OpenRouter API key:

```
VITE_OPENROUTER_API_KEY=sk-or-...
```

## Development Commands

```sh
bun dev           # Start all services
bun dev:web       # Start web client only
bun tsc           # Type check
bun lint          # Lint code
bun format        # Format code
```

## How It Works

1. **Puzzle Generation**: Procedurally generates solvable puzzles by backward-tracing from goal states, then validates with the BFS solver to ensure solution length is within the target range.

2. **AI Evaluation**: Sends the puzzle state to an LLM with configurable prompts. The AI returns a solution in Sokoban notation (UDLR), which is parsed and executed move-by-move with visual feedback.

3. **Solver**: BFS explores all reachable states (player position + box positions) to find the optimal solution. Includes corner deadlock pruning to reduce search space.
