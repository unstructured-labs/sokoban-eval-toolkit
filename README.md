# Sokoban Eval Toolkit

A web-based Sokoban puzzle environment for evaluating AI language models on spatial reasoning and planning tasks. Features procedural puzzle generation, a custom puzzle editor, an A* solver, and AI model integration via OpenRouter.

## Quick Start

```sh
bun install
bun dev
```

Open http://localhost:5173 to play.

## Features

### Puzzle Modes

**Generated:**
- **Eval Easy** - 1-3 boxes, sparse walls, very easy (4-12 grid)
- **Mixed Custom** - 2-4 boxes, random maze-based puzzles (8-12 grid)

**Curated:**
- **LM IQ Reasoning Easy** - Benchmark puzzles, 1-4 boxes (100 levels)
- **Microban** - Classic beginner puzzles by David Skinner (155 levels)
- **Classic** - Medium difficulty from [boxoban-levels](https://github.com/google-deepmind/boxoban-levels) (10×10, 4 boxes)
- **Classic Hard** - Hard difficulty from boxoban-levels (10×10, 4 boxes)

### Custom Puzzle Editor

- Toggle edit mode to create custom puzzles
- Place/remove walls, goals, and colored boxes (orange, purple, emerald, sky)
- Colored box rules: same-color boxes cannot be adjacent
- Save and load custom layouts

### AI Integration

- Connect any LLM via OpenRouter API
- Configurable prompt formats (ASCII grid, coordinates)
- Full solution or move-by-move execution modes
- Token usage and cost tracking
- Solution replay functionality

### Built-in Solver

- A* search with push-level optimization
- Manual "Find Solution" button (non-blocking async execution)
- One-click solution playback
- Deadlock detection (corners, freeze patterns)

### Controls

| Key | Action |
|-----|--------|
| Arrow Keys | Move player |
| Z / Backspace | Undo move |
| R | Reset puzzle |
| N | Generate new puzzle |

**Edit Mode:**
| Key | Action |
|-----|--------|
| W | Toggle wall placement |
| G | Toggle goal placement |
| O / P / E / S | Toggle orange/purple/emerald/sky box |
| Escape | Toggle remove mode |

## Project Structure

```
apps/
  ui-sokoban/     # Main Sokoban game UI (Vite + React)
packages/
  ui-library/     # Shared UI components (ShadCN)
  utils/          # Shared utilities (OpenRouter models, etc.)
```

## Environment Setup

Create a `.env` file with your OpenRouter API key:

```
VITE_OPENROUTER_API_KEY=sk-or-...
```

## Development Commands

```sh
bun dev           # Start the Sokoban game
bun tsc           # Type check
bun lint          # Lint code
bun format        # Format code
```

## How It Works

1. **Puzzle Generation**: Procedurally generates solvable puzzles by backward-tracing from goal states, then validates with the solver to ensure solution length is within the target range.

2. **AI Evaluation**: Sends the puzzle state to an LLM with configurable prompts. The AI returns a solution in Sokoban notation (UDLR), which is parsed and executed move-by-move with visual feedback.

3. **Solver**: A* search at the push level - only expands states when boxes are pushed, using Manhattan distance heuristic. Includes deadlock detection (corner traps, freeze patterns) to prune the search space.
