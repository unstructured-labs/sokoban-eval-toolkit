import type { Box, CellTerrain, Difficulty, Position, SokobanLevel } from '../types'
import { findFloorPositions, getReachablePositions, randomInt, shuffle } from './generatorUtils'
import { solvePuzzle } from './sokobanSolver'

// Configuration for mixed-custom level generation
const CONFIG = {
  minSize: 8,
  maxSize: 12,
  minBoxes: 2,
  maxBoxes: 4,
  minMoves: 5,
  maxMoves: 50,
  maxAttempts: 1000,
  maxSolverNodes: 100000,
}

// Direction vectors for maze generation (uses row/col convention)
const MAZE_DIRS = [
  { dr: -1, dc: 0 }, // up
  { dr: 1, dc: 0 }, // down
  { dr: 0, dc: -1 }, // left
  { dr: 0, dc: 1 }, // right
]

/**
 * Generate a maze using recursive backtracking.
 * Creates grid-like corridors with right angles.
 */
function generateMaze(height: number, width: number): string[][] {
  const grid: string[][] = Array.from({ length: height }, () => Array(width).fill('#'))

  function carve(r: number, c: number) {
    grid[r][c] = ' '
    const shuffledDirs = shuffle([...MAZE_DIRS])

    for (const { dr, dc } of shuffledDirs) {
      const nr = r + dr * 2
      const nc = c + dc * 2

      if (nr > 0 && nr < height - 1 && nc > 0 && nc < width - 1 && grid[nr][nc] === '#') {
        grid[r + dr][c + dc] = ' '
        carve(nr, nc)
      }
    }
  }

  carve(1, 1)
  return grid
}

/**
 * Find all valid "pull" moves (reverse of push).
 */
function findValidPulls(
  grid: string[][],
  player: Position,
  boxes: Position[],
): { player: Position; boxes: Position[] }[] {
  const reachable = getReachablePositions(grid, player, boxes)
  const pulls: { player: Position; boxes: Position[] }[] = []

  boxes.forEach((box, idx) => {
    for (const d of MAZE_DIRS) {
      const pFrom: Position = { x: box.x + d.dc, y: box.y + d.dr }
      const pTo: Position = { x: box.x + 2 * d.dc, y: box.y + 2 * d.dr }

      if (!reachable.has(`${pFrom.x},${pFrom.y}`)) continue

      const cell = grid[pTo.y]?.[pTo.x]
      if (cell !== ' ' && cell !== '.') continue

      if (boxes.some((b) => b.x === pTo.x && b.y === pTo.y)) continue

      const newBoxes = boxes.map((b, i) => (i === idx ? pFrom : b))
      pulls.push({ player: pTo, boxes: newBoxes })
    }
  })

  return pulls
}

/**
 * Build SokobanLevel from internal representation.
 */
function buildLevel(
  grid: string[][],
  player: Position,
  boxes: Position[],
  goals: Position[],
  attempt: number,
  optimalMoves?: number,
): SokobanLevel {
  const height = grid.length
  const width = grid[0].length

  const terrain: CellTerrain[][] = grid.map((row, y) =>
    row.map((cell, x) => {
      if (cell === '#') return 'wall'
      if (goals.some((g) => g.x === x && g.y === y)) return 'goal'
      return 'floor'
    }),
  )

  // Convert Position[] to Box[] with default orange color
  const boxStarts: Box[] = boxes.map((b) => ({ ...b, color: 'orange' }))

  return {
    id: `mixed-custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    width,
    height,
    terrain,
    playerStart: player,
    boxStarts,
    goals,
    difficulty: 'mixed-custom' as Difficulty,
    fileSource: 'generated',
    puzzleNumber: attempt,
    generationIterations: attempt,
    optimalMoves,
  }
}

/**
 * Create a simple fallback puzzle.
 */
function createFallbackPuzzle(totalAttempts: number): SokobanLevel {
  const width = 8
  const height = 8

  const terrain: CellTerrain[][] = []
  for (let y = 0; y < height; y++) {
    const row: CellTerrain[] = []
    for (let x = 0; x < width; x++) {
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        row.push('wall')
      } else if (x === 5 && y === 3) {
        row.push('goal')
      } else if (x === 5 && y === 4) {
        row.push('goal')
      } else {
        row.push('floor')
      }
    }
    terrain.push(row)
  }

  return {
    id: `mixed-custom-fallback-${Date.now()}`,
    width,
    height,
    terrain,
    playerStart: { x: 2, y: 3 },
    boxStarts: [
      { x: 4, y: 3, color: 'orange' },
      { x: 4, y: 4, color: 'orange' },
    ],
    goals: [
      { x: 5, y: 3 },
      { x: 5, y: 4 },
    ],
    difficulty: 'mixed-custom' as Difficulty,
    fileSource: 'generated',
    puzzleNumber: 1,
    generationIterations: totalAttempts,
    usedFallback: true,
    optimalMoves: 2,
  }
}

/**
 * Generate a mixed-custom level using reverse scramble approach.
 * Randomly picks grid size (8-12) and box count (2-4).
 */
export function generateMixedCustomLevel(): SokobanLevel {
  console.log('[MixedCustomGenerator] Starting generation...')

  for (let attempt = 1; attempt <= CONFIG.maxAttempts; attempt++) {
    // Random settings
    const size = randomInt(CONFIG.minSize, CONFIG.maxSize)
    const numBoxes = randomInt(CONFIG.minBoxes, CONFIG.maxBoxes)

    // Generate maze
    const grid = generateMaze(size, size)
    const floors = findFloorPositions(grid)

    // Need enough floors for boxes, goals, and player
    if (floors.length < numBoxes * 2 + 1) {
      if (attempt % 100 === 0) {
        console.log(
          `[MixedCustomGenerator] Attempt ${attempt}: Not enough floors (${floors.length})`,
        )
      }
      continue
    }

    // Place goals randomly
    const shuffledFloors = shuffle([...floors])
    const goals = shuffledFloors.slice(0, numBoxes)

    // Mark goals in grid
    for (const g of goals) {
      grid[g.y][g.x] = '.'
    }

    // Initialize solved state: boxes on goals
    const playerFloor = shuffledFloors.find((f) => !goals.some((g) => g.x === f.x && g.y === f.y))
    if (!playerFloor) continue

    let player = playerFloor
    let boxes = goals.map((g) => ({ x: g.x, y: g.y }))

    // Reverse scramble: apply random pulls
    const scrambleSteps = randomInt(15, 60)
    for (let i = 0; i < scrambleSteps; i++) {
      const pulls = findValidPulls(grid, player, boxes)
      if (pulls.length === 0) break
      const pull = pulls[Math.floor(Math.random() * pulls.length)]
      player = pull.player
      boxes = pull.boxes
    }

    // Build candidate level
    const candidateLevel = buildLevel(grid, player, boxes, goals, attempt)

    // Validate with solver
    const result = solvePuzzle(candidateLevel, CONFIG.maxSolverNodes)

    if (!result.solvable) {
      if (attempt % 100 === 0) {
        console.log(`[MixedCustomGenerator] Attempt ${attempt}: Unsolvable`)
      }
      continue
    }

    // Check move count is within range
    if (result.moveCount < CONFIG.minMoves) {
      if (attempt % 50 === 0) {
        console.log(
          `[MixedCustomGenerator] Attempt ${attempt}: Too easy (${result.moveCount} < ${CONFIG.minMoves})`,
        )
      }
      continue
    }

    if (result.moveCount > CONFIG.maxMoves) {
      if (attempt % 50 === 0) {
        console.log(
          `[MixedCustomGenerator] Attempt ${attempt}: Too hard (${result.moveCount} > ${CONFIG.maxMoves})`,
        )
      }
      continue
    }

    // Success!
    console.log(
      `[MixedCustomGenerator] SUCCESS! Found puzzle in ${attempt} attempts (${result.moveCount} moves, ${numBoxes} boxes, ${size}x${size})`,
    )

    return buildLevel(grid, player, boxes, goals, attempt, result.moveCount)
  }

  // Fallback
  console.log(
    `[MixedCustomGenerator] FALLBACK: No valid puzzle found after ${CONFIG.maxAttempts} attempts`,
  )
  return createFallbackPuzzle(CONFIG.maxAttempts)
}
