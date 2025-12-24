import type { CellTerrain, Difficulty, Position, SokobanLevel } from '../types'
import { solvePuzzle } from './sokobanSolver'

// Configuration for easy-custom level generation
const CONFIG = {
  width: 8,
  height: 8,
  minFloors: 15,
  minPushes: 2,
  maxPushes: 8,
  minMoves: 10,
  maxMoves: 40,
  minScrambleSteps: 15,
  maxScrambleSteps: 40,
  maxAttempts: 500,
}

// Internal position type (row/column based for algorithm clarity)
interface Pos {
  r: number
  c: number
}

// Internal state for reverse scramble
interface State {
  player: Pos
  boxes: Pos[]
}

// Direction vectors
const DIRS = [
  { dr: -1, dc: 0 }, // up
  { dr: 1, dc: 0 }, // down
  { dr: 0, dc: -1 }, // left
  { dr: 0, dc: 1 }, // right
]

/**
 * Shuffle an array in place using Fisher-Yates algorithm.
 */
function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Generate a random integer between min and max (inclusive).
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Generate a maze using recursive backtracking.
 * Creates grid-like corridors with right angles (Microban style).
 */
function generateMaze(height: number, width: number): string[][] {
  // Initialize grid with all walls
  const grid: string[][] = Array.from({ length: height }, () => Array(width).fill('#'))

  // Recursive backtracking carver
  function carve(r: number, c: number) {
    grid[r][c] = ' '
    const shuffledDirs = shuffle([...DIRS])

    for (const { dr, dc } of shuffledDirs) {
      // Move 2 cells in direction (to create corridor effect)
      const nr = r + dr * 2
      const nc = c + dc * 2

      // Check if new position is valid and unvisited
      if (nr > 0 && nr < height - 1 && nc > 0 && nc < width - 1 && grid[nr][nc] === '#') {
        // Carve the wall between current and new position
        grid[r + dr][c + dc] = ' '
        carve(nr, nc)
      }
    }
  }

  // Start carving from (1,1)
  carve(1, 1)

  return grid
}

/**
 * Find all floor positions in the grid.
 */
function findFloors(grid: string[][]): Pos[] {
  const floors: Pos[] = []
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (grid[r][c] === ' ' || grid[r][c] === '.') {
        floors.push({ r, c })
      }
    }
  }
  return floors
}

/**
 * Get all positions reachable by player using BFS flood fill.
 * Takes box positions into account as obstacles.
 */
function getReachable(grid: string[][], player: Pos, boxes: Pos[]): Set<string> {
  const visited = new Set<string>([`${player.r},${player.c}`])
  const queue: Pos[] = [player]

  while (queue.length > 0) {
    const curr = queue.shift()
    if (!curr) break

    for (const { dr, dc } of DIRS) {
      const nr = curr.r + dr
      const nc = curr.c + dc
      const key = `${nr},${nc}`

      // Check if valid floor and not visited
      const cell = grid[nr]?.[nc]
      if (
        (cell === ' ' || cell === '.') &&
        !boxes.some((b) => b.r === nr && b.c === nc) &&
        !visited.has(key)
      ) {
        visited.add(key)
        queue.push({ r: nr, c: nc })
      }
    }
  }

  return visited
}

/**
 * Find all valid "pull" moves (reverse of push).
 *
 * A pull occurs when:
 * 1. Player stands adjacent to a box (pull-from position)
 * 2. Player moves further away from box (pull-to position)
 * 3. Box moves to where player was
 */
function findValidPulls(grid: string[][], state: State): State[] {
  const reachable = getReachable(grid, state.player, state.boxes)
  const pulls: State[] = []

  state.boxes.forEach((box, idx) => {
    for (const d of DIRS) {
      // Pull-from position: player stands adjacent to box
      const pFrom: Pos = { r: box.r + d.dr, c: box.c + d.dc }
      // Pull-to position: player moves further away
      const pTo: Pos = { r: box.r + 2 * d.dr, c: box.c + 2 * d.dc }

      // Check if player can reach the pull-from position
      if (!reachable.has(`${pFrom.r},${pFrom.c}`)) continue

      // Check if pull-to position is valid floor
      const cell = grid[pTo.r]?.[pTo.c]
      if (cell !== ' ' && cell !== '.') continue

      // Check if no box at pull-to position
      if (state.boxes.some((b) => b.r === pTo.r && b.c === pTo.c)) continue

      // Valid pull: box moves to where player was
      const newBoxes = state.boxes.map((b, i) => (i === idx ? pFrom : b))
      pulls.push({ player: pTo, boxes: newBoxes })
    }
  })

  return pulls
}

/**
 * Convert internal grid and state to SokobanLevel format.
 */
function buildSokobanLevel(
  grid: string[][],
  state: State,
  goals: Pos[],
  attempt: number,
  optimalMoves?: number,
): SokobanLevel {
  const height = grid.length
  const width = grid[0].length

  // Convert grid to terrain (floor/wall/goal)
  const terrain: CellTerrain[][] = grid.map((row, r) =>
    row.map((cell, c) => {
      if (cell === '#') return 'wall'
      if (goals.some((g) => g.r === r && g.c === c)) return 'goal'
      return 'floor'
    }),
  )

  // Convert positions from row/col to x/y
  const playerStart: Position = { x: state.player.c, y: state.player.r }
  const boxStarts: Position[] = state.boxes.map((b) => ({ x: b.c, y: b.r }))
  const goalPositions: Position[] = goals.map((g) => ({ x: g.c, y: g.r }))

  return {
    id: `easy-custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    width,
    height,
    terrain,
    playerStart,
    boxStarts,
    goals: goalPositions,
    difficulty: 'easy-custom' as Difficulty,
    fileSource: 'generated',
    puzzleNumber: attempt,
    generationIterations: attempt,
    optimalMoves,
  }
}

/**
 * Create a simple fallback puzzle when generation fails.
 */
function createFallbackPuzzle(): SokobanLevel {
  const width = 8
  const height = 8

  // Simple open room with border walls
  const terrain: CellTerrain[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) return 'wall'
      if (x === 5 && y === 3) return 'goal'
      return 'floor'
    }),
  )

  return {
    id: `easy-custom-fallback-${Date.now()}`,
    width,
    height,
    terrain,
    playerStart: { x: 2, y: 3 },
    boxStarts: [{ x: 4, y: 3 }],
    goals: [{ x: 5, y: 3 }],
    difficulty: 'easy-custom' as Difficulty,
    fileSource: 'generated',
    puzzleNumber: 1,
    generationIterations: CONFIG.maxAttempts,
    usedFallback: true,
    optimalMoves: 1,
  }
}

/**
 * Generate an easy-custom level using reverse scramble approach.
 *
 * Algorithm:
 * 1. Generate maze using recursive backtracking
 * 2. Place 1-3 goals randomly on floor cells
 * 3. Initialize solved state (boxes on goals)
 * 4. Reverse scramble: simulate pulls to create starting position
 * 5. Validate with solver to ensure proper difficulty
 */
export function generateEasyCustomLevel(): SokobanLevel {
  console.log('[EasyCustomGenerator] Starting generation...')

  for (let attempt = 1; attempt <= CONFIG.maxAttempts; attempt++) {
    // 1. Generate maze
    const grid = generateMaze(CONFIG.height, CONFIG.width)
    const floors = findFloors(grid)

    // Check minimum floor count
    if (floors.length < CONFIG.minFloors) {
      if (attempt % 100 === 0) {
        console.log(
          `[EasyCustomGenerator] Attempt ${attempt}: Not enough floors (${floors.length})`,
        )
      }
      continue
    }

    // 2. Place goals (1-3 random)
    const numBoxes = randomInt(1, 3)
    const shuffledFloors = shuffle([...floors])
    const goals = shuffledFloors.slice(0, numBoxes)

    // Mark goals in grid (for reference, though we track separately)
    for (const g of goals) {
      grid[g.r][g.c] = '.'
    }

    // 3. Initialize solved state: boxes on goals, player on any other floor
    const playerFloor = shuffledFloors.find((f) => !goals.some((g) => g.r === f.r && g.c === f.c))

    if (!playerFloor) continue

    let state: State = {
      player: playerFloor,
      boxes: goals.map((g) => ({ r: g.r, c: g.c })),
    }

    // 4. Reverse scramble: apply random pulls
    const scrambleSteps = randomInt(CONFIG.minScrambleSteps, CONFIG.maxScrambleSteps)
    for (let i = 0; i < scrambleSteps; i++) {
      const pulls = findValidPulls(grid, state)
      if (pulls.length === 0) break
      state = pulls[Math.floor(Math.random() * pulls.length)]
    }

    // 5. Validate with solver
    const candidateLevel = buildSokobanLevel(grid, state, goals, attempt)
    const result = solvePuzzle(candidateLevel, 50000)

    if (!result.solvable) {
      if (attempt % 100 === 0) {
        console.log(`[EasyCustomGenerator] Attempt ${attempt}: Unsolvable (should not happen!)`)
      }
      continue
    }

    // Check move count is within desired range
    if (result.moveCount < CONFIG.minMoves) {
      if (attempt % 50 === 0) {
        console.log(
          `[EasyCustomGenerator] Attempt ${attempt}: Too easy (${result.moveCount} < ${CONFIG.minMoves} moves)`,
        )
      }
      continue
    }

    if (result.moveCount > CONFIG.maxMoves) {
      if (attempt % 50 === 0) {
        console.log(
          `[EasyCustomGenerator] Attempt ${attempt}: Too hard (${result.moveCount} > ${CONFIG.maxMoves} moves)`,
        )
      }
      continue
    }

    // Success!
    console.log(
      `[EasyCustomGenerator] SUCCESS! Found puzzle in ${attempt} attempts (${result.moveCount} moves, ${numBoxes} boxes)`,
    )

    return buildSokobanLevel(grid, state, goals, attempt, result.moveCount)
  }

  // Fallback
  console.log(
    `[EasyCustomGenerator] FALLBACK: No valid puzzle found after ${CONFIG.maxAttempts} attempts`,
  )
  return createFallbackPuzzle()
}
