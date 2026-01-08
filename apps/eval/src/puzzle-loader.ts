import type { ExportedPuzzles, SavedLayout, SokobanLevel } from './types'

/**
 * Load puzzles from an exported JSON file.
 */
export async function loadPuzzles(filePath: string): Promise<SavedLayout[]> {
  const file = Bun.file(filePath)

  if (!(await file.exists())) {
    throw new Error(`Puzzle file not found: ${filePath}`)
  }

  const content = await file.text()
  let data: ExportedPuzzles

  try {
    data = JSON.parse(content)
  } catch {
    throw new Error(`Invalid JSON in puzzle file: ${filePath}`)
  }

  // Validate export format
  if (!data.version || data.version !== 1) {
    throw new Error(`Unsupported puzzle export version: ${data.version}`)
  }

  if (!Array.isArray(data.puzzles)) {
    throw new Error('Invalid puzzle file: missing puzzles array')
  }

  if (data.puzzles.length === 0) {
    throw new Error('Puzzle file contains no puzzles')
  }

  // Validate each puzzle has required fields
  for (const puzzle of data.puzzles) {
    validatePuzzle(puzzle)
  }

  return data.puzzles
}

/**
 * Validate a puzzle has all required fields.
 */
function validatePuzzle(puzzle: SavedLayout): void {
  const required = ['id', 'name', 'width', 'height', 'terrain', 'playerStart', 'boxStarts', 'goals']

  for (const field of required) {
    if (!(field in puzzle)) {
      throw new Error(`Puzzle "${puzzle.name || 'unknown'}" missing required field: ${field}`)
    }
  }

  if (puzzle.boxStarts.length === 0) {
    throw new Error(`Puzzle "${puzzle.name}" has no boxes`)
  }

  if (puzzle.goals.length === 0) {
    throw new Error(`Puzzle "${puzzle.name}" has no goals`)
  }

  if (puzzle.boxStarts.length !== puzzle.goals.length) {
    throw new Error(
      `Puzzle "${puzzle.name}" has mismatched boxes (${puzzle.boxStarts.length}) and goals (${puzzle.goals.length})`,
    )
  }
}

/**
 * Convert a SavedLayout to a SokobanLevel for the game engine.
 */
export function savedLayoutToLevel(layout: SavedLayout): SokobanLevel {
  return {
    id: layout.id,
    width: layout.width,
    height: layout.height,
    terrain: layout.terrain,
    playerStart: layout.playerStart,
    boxStarts: layout.boxStarts,
    goals: layout.goals,
    difficulty: layout.difficulty || 'classic',
    fileSource: 'saved',
    puzzleNumber: 0,
  }
}

/**
 * Get a summary of puzzles for display.
 */
export function getPuzzleSummary(puzzles: SavedLayout[]): {
  total: number
  byDifficulty: Record<string, number>
  gridSizes: string[]
  totalBoxes: number
} {
  const byDifficulty: Record<string, number> = {}
  const gridSizes = new Set<string>()
  let totalBoxes = 0

  for (const puzzle of puzzles) {
    const difficulty = puzzle.difficulty || 'classic'
    byDifficulty[difficulty] = (byDifficulty[difficulty] || 0) + 1
    gridSizes.add(`${puzzle.width}x${puzzle.height}`)
    totalBoxes += puzzle.boxStarts.length
  }

  return {
    total: puzzles.length,
    byDifficulty,
    gridSizes: Array.from(gridSizes).sort(),
    totalBoxes,
  }
}
