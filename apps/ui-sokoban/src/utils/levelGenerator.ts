import type { CellTerrain, Difficulty, Position, SokobanLevel } from '../types'
import { solvePuzzle } from './sokobanSolver'
import { generateInterestingLevel } from './wallGenerators'

export interface GeneratorOptions {
  /** Number of boxes to place. If not set, uses difficulty preset. */
  numBoxes?: number
  /** Minimum solution length. If not set, uses difficulty preset. */
  minSolutionLength?: number
  /** Maximum attempts to find a valid puzzle. Default: 1000 */
  maxAttempts?: number
  /** Initial wall fill percentage for cellular automata (0.4-0.5 recommended). Default: 0.46 */
  fillPercent?: number
  /** Number of CA smoothing iterations (3-5 recommended). Default: 4 */
  iterations?: number
  /** Grid size (width and height). Overrides difficulty preset. Default: 12 */
  gridSize?: number
}

interface DifficultyPreset {
  width: number
  height: number
  numBoxes: number
  minSolutionLength: number
  maxSolutionLength: number
  maxSolverNodes: number
}

// Difficulty presets (only for generated difficulties, not classic or microban)
const DIFFICULTY_PRESETS: Record<Exclude<Difficulty, 'classic' | 'microban'>, DifficultyPreset> = {
  easy: {
    width: 8,
    height: 8,
    numBoxes: 2,
    minSolutionLength: 5,
    maxSolutionLength: 20,
    maxSolverNodes: 50000,
  },
  medium: {
    width: 9,
    height: 9,
    numBoxes: 3,
    minSolutionLength: 8,
    maxSolutionLength: 30,
    maxSolverNodes: 100000,
  },
  hard: {
    width: 10,
    height: 10,
    numBoxes: 4,
    minSolutionLength: 12,
    maxSolutionLength: 50,
    maxSolverNodes: 200000,
  },
}

/**
 * Generate a solvable Sokoban puzzle using cellular automata terrain generation.
 *
 * Strategy:
 * 1. Generate organic cave-like terrain using cellular automata
 * 2. Place goals on valid floor positions
 * 3. Place boxes that can reach goals (traced backward)
 * 4. Place player adjacent to a box
 * 5. Verify solvability with BFS solver
 * 6. Repeat until valid puzzle found or max attempts reached
 */
export function generateLevel(
  difficulty: Exclude<Difficulty, 'classic' | 'microban'>,
  options?: GeneratorOptions,
): SokobanLevel {
  const preset = DIFFICULTY_PRESETS[difficulty]
  const { maxSolutionLength, maxSolverNodes } = preset

  // Grid size can be overridden, defaults to 12
  const gridSize = options?.gridSize ?? 12
  const width = gridSize
  const height = gridSize

  const numBoxes = options?.numBoxes ?? preset.numBoxes
  const minSolutionLength = options?.minSolutionLength ?? preset.minSolutionLength
  const maxAttempts = options?.maxAttempts ?? 1000
  const fillPercent = options?.fillPercent ?? 0.46
  const iterations = options?.iterations ?? 4

  console.log(
    `[Generator] Starting: ${difficulty}, ${numBoxes} boxes, minSolution=${minSolutionLength}, maxAttempts=${maxAttempts}`,
  )

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Generate organic terrain
    const { terrain } = generateInterestingLevel({
      width,
      height,
      fillPercent,
      iterations,
    })

    // Try to place goals, boxes, and player
    const placement = tryPlaceEntities(terrain, numBoxes, width, height)
    if (!placement) {
      if (attempt % 100 === 0) {
        console.log(`[Generator] Attempt ${attempt}: Failed to place entities`)
      }
      continue
    }

    const candidateLevel: SokobanLevel = {
      id: `${difficulty}-generated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      width,
      height,
      terrain: placement.terrain,
      playerStart: placement.playerPos,
      boxStarts: placement.boxes,
      goals: placement.goals,
      difficulty,
      fileSource: 'generated',
      puzzleNumber: attempt,
    }

    // Verify with solver
    const solverResult = solvePuzzle(candidateLevel, maxSolverNodes)

    if (!solverResult.solvable) {
      if (attempt % 100 === 0) {
        console.log(`[Generator] Attempt ${attempt}: Unsolvable`)
      }
      continue
    }

    if (solverResult.moveCount < minSolutionLength) {
      if (attempt % 50 === 0) {
        console.log(
          `[Generator] Attempt ${attempt}: Too easy (${solverResult.moveCount} < ${minSolutionLength} moves)`,
        )
      }
      continue
    }

    if (solverResult.moveCount > maxSolutionLength) {
      if (attempt % 50 === 0) {
        console.log(
          `[Generator] Attempt ${attempt}: Too hard (${solverResult.moveCount} > ${maxSolutionLength} moves)`,
        )
      }
      continue
    }

    // Valid puzzle found!
    console.log(
      `[Generator] SUCCESS! Found puzzle in ${attempt} attempts (${solverResult.moveCount} moves)`,
    )

    return {
      ...candidateLevel,
      optimalMoves: solverResult.moveCount,
      generationIterations: attempt,
    }
  }

  // Fallback: return a simple puzzle
  console.log(
    `[Generator] FALLBACK: No valid puzzle found after ${maxAttempts} attempts, using simple fallback`,
  )
  return createFallbackPuzzle(width, height, numBoxes, difficulty, maxAttempts)
}

/**
 * Try to place goals, boxes, and player on the terrain.
 */
function tryPlaceEntities(
  terrain: CellTerrain[][],
  numBoxes: number,
  width: number,
  height: number,
): {
  terrain: CellTerrain[][]
  goals: Position[]
  boxes: Position[]
  playerPos: Position
} | null {
  // Make a copy of terrain to modify
  const terrainCopy: CellTerrain[][] = terrain.map((row) => [...row])

  // Find all valid floor positions (not on border)
  const floorPositions: Position[] = []
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      if (terrainCopy[y][x] === 'floor') {
        // Check if has enough adjacent floors for pushing
        const adjacentFloors = countAdjacentFloors(terrainCopy, x, y)
        if (adjacentFloors >= 2) {
          floorPositions.push({ x, y })
        }
      }
    }
  }

  // Need enough floor positions for goals + boxes + player
  if (floorPositions.length < numBoxes * 2 + 1) {
    return null
  }

  // Shuffle positions for randomness
  shuffleArray(floorPositions)

  // Place goals
  const goals: Position[] = []
  for (let i = 0; i < numBoxes && i < floorPositions.length; i++) {
    const pos = floorPositions[i]
    goals.push(pos)
    terrainCopy[pos.y][pos.x] = 'goal'
  }

  if (goals.length < numBoxes) return null

  // Place boxes (not on goals, not adjacent to each other)
  const boxes: Position[] = []
  const usedPositions = new Set(goals.map((g) => `${g.x},${g.y}`))

  for (let i = numBoxes; i < floorPositions.length && boxes.length < numBoxes; i++) {
    const pos = floorPositions[i]
    const key = `${pos.x},${pos.y}`

    if (usedPositions.has(key)) continue

    // Check not adjacent to another box (prevents immediate deadlocks)
    const adjacentToBox = boxes.some((b) => Math.abs(b.x - pos.x) + Math.abs(b.y - pos.y) === 1)
    if (adjacentToBox) continue

    // Check box can be pushed (has floor on opposite sides)
    if (!canBePushed(terrainCopy, pos)) continue

    boxes.push(pos)
    usedPositions.add(key)
  }

  if (boxes.length < numBoxes) return null

  // Place player (adjacent to a box, on floor)
  let playerPos: Position | null = null
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ]

  // Shuffle boxes to randomize which one player starts near
  const shuffledBoxes = [...boxes].sort(() => Math.random() - 0.5)

  for (const box of shuffledBoxes) {
    const shuffledDirs = [...directions].sort(() => Math.random() - 0.5)
    for (const dir of shuffledDirs) {
      const px = box.x + dir.dx
      const py = box.y + dir.dy
      const cell = terrainCopy[py]?.[px]

      if ((cell === 'floor' || cell === 'goal') && !usedPositions.has(`${px},${py}`)) {
        playerPos = { x: px, y: py }
        break
      }
    }
    if (playerPos) break
  }

  if (!playerPos) {
    // Fallback: any floor position not used
    for (const pos of floorPositions) {
      if (!usedPositions.has(`${pos.x},${pos.y}`)) {
        playerPos = pos
        break
      }
    }
  }

  if (!playerPos) return null

  return {
    terrain: terrainCopy,
    goals,
    boxes,
    playerPos,
  }
}

/**
 * Check if a box at position can theoretically be pushed (has opposing floors).
 */
function canBePushed(terrain: CellTerrain[][], pos: Position): boolean {
  const cell = (x: number, y: number) => terrain[y]?.[x]
  const isFloorOrGoal = (x: number, y: number) => {
    const c = cell(x, y)
    return c === 'floor' || c === 'goal'
  }

  // Check horizontal push possibility
  const canPushHorizontal = isFloorOrGoal(pos.x - 1, pos.y) && isFloorOrGoal(pos.x + 1, pos.y)

  // Check vertical push possibility
  const canPushVertical = isFloorOrGoal(pos.x, pos.y - 1) && isFloorOrGoal(pos.x, pos.y + 1)

  return canPushHorizontal || canPushVertical
}

function countAdjacentFloors(terrain: CellTerrain[][], x: number, y: number): number {
  let count = 0
  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ]
  for (const { dx, dy } of dirs) {
    const cell = terrain[y + dy]?.[x + dx]
    if (cell === 'floor' || cell === 'goal') count++
  }
  return count
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
}

function createFallbackPuzzle(
  width: number,
  height: number,
  numBoxes: number,
  difficulty: Exclude<Difficulty, 'classic'>,
  totalAttempts: number,
): SokobanLevel {
  // Create a simple open puzzle
  const terrain: CellTerrain[][] = []
  for (let y = 0; y < height; y++) {
    const row: CellTerrain[] = []
    for (let x = 0; x < width; x++) {
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        row.push('wall')
      } else {
        row.push('floor')
      }
    }
    terrain.push(row)
  }

  const centerX = Math.floor(width / 2)
  const centerY = Math.floor(height / 2)

  const goals: Position[] = []
  const boxStarts: Position[] = []

  for (let i = 0; i < numBoxes; i++) {
    const yOffset = i - Math.floor(numBoxes / 2)
    const goalY = centerY + yOffset

    if (goalY > 0 && goalY < height - 1) {
      terrain[goalY][centerX + 2] = 'goal'
      goals.push({ x: centerX + 2, y: goalY })
      boxStarts.push({ x: centerX, y: goalY })
    }
  }

  const level: SokobanLevel = {
    id: `${difficulty}-fallback-${Date.now()}`,
    width,
    height,
    terrain,
    playerStart: { x: centerX - 2, y: centerY },
    boxStarts,
    goals,
    difficulty,
    fileSource: 'generated',
    puzzleNumber: 1,
    generationIterations: totalAttempts,
    usedFallback: true,
  }

  const result = solvePuzzle(level)
  if (result.solvable) {
    level.optimalMoves = result.moveCount
  }

  return level
}
