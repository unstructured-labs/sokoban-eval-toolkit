import type { Box, CellTerrain, Difficulty, Position, SokobanLevel } from '../types'
import { canBePushed, countAdjacentFloors, isConnected, randomInt, shuffle } from './generatorUtils'
import { solvePuzzle } from './sokobanSolver'

// Configuration for eval-easy level generation
const CONFIG = {
  minSize: 4,
  maxSize: 12,
  minBoxes: 1,
  maxBoxes: 3,
  minMoves: 1,
  maxMoves: 20,
  maxAttempts: 500,
  maxSolverNodes: 50000,
}

/**
 * Generate terrain with border walls and sparse internal walls.
 * For small grids, we add fewer or no internal walls.
 */
function generateTerrain(width: number, height: number): CellTerrain[][] {
  // Start with all floors except borders
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

  // For small grids (< 6), don't add internal walls
  if (width < 6 || height < 6) {
    return terrain
  }

  // Scale internal walls based on grid size
  const interiorArea = (width - 2) * (height - 2)
  const maxWalls = Math.min(Math.floor(interiorArea * 0.15), 10)
  const numInternalWalls = randomInt(0, maxWalls)

  // Collect interior positions (leaving 1 cell buffer from border)
  const interiorPositions: Position[] = []
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      interiorPositions.push({ x, y })
    }
  }

  if (interiorPositions.length === 0) {
    return terrain
  }

  // Shuffle and try to add walls
  const shuffled = shuffle(interiorPositions)
  let wallsAdded = 0

  for (const pos of shuffled) {
    if (wallsAdded >= numInternalWalls) break

    // Temporarily add wall
    terrain[pos.y][pos.x] = 'wall'

    // Check if still connected
    if (isConnected(terrain, width, height)) {
      wallsAdded++
    } else {
      // Revert
      terrain[pos.y][pos.x] = 'floor'
    }
  }

  return terrain
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
  boxes: Box[]
  playerPos: Position
} | null {
  const terrainCopy: CellTerrain[][] = terrain.map((row) => [...row])

  // Find all valid floor positions (interior cells with enough adjacent floors)
  const floorPositions: Position[] = []
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (terrainCopy[y][x] === 'floor') {
        const adjacentFloors = countAdjacentFloors(terrainCopy, x, y)
        if (adjacentFloors >= 2) {
          floorPositions.push({ x, y })
        }
      }
    }
  }

  if (floorPositions.length < numBoxes * 2 + 1) {
    return null
  }

  const shuffledFloors = shuffle(floorPositions)

  // Place goals
  const goals: Position[] = []
  for (let i = 0; i < numBoxes && i < shuffledFloors.length; i++) {
    const pos = shuffledFloors[i]
    goals.push(pos)
    terrainCopy[pos.y][pos.x] = 'goal'
  }

  if (goals.length < numBoxes) return null

  // Place boxes (not on goals, not adjacent to each other)
  const boxes: Box[] = []
  const usedPositions = new Set(goals.map((g) => `${g.x},${g.y}`))

  for (let i = numBoxes; i < shuffledFloors.length && boxes.length < numBoxes; i++) {
    const pos = shuffledFloors[i]
    const key = `${pos.x},${pos.y}`

    if (usedPositions.has(key)) continue

    // Check not adjacent to another box
    const adjacentToBox = boxes.some((b) => Math.abs(b.x - pos.x) + Math.abs(b.y - pos.y) === 1)
    if (adjacentToBox) continue

    // Check box can be pushed
    if (!canBePushed(terrainCopy, pos)) continue

    boxes.push({ ...pos, color: 'orange' })
    usedPositions.add(key)
  }

  if (boxes.length < numBoxes) return null

  // Place player adjacent to a box
  let playerPos: Position | null = null
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ]

  const shuffledBoxes = shuffle([...boxes])

  for (const box of shuffledBoxes) {
    const shuffledDirs = shuffle([...directions])
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
    for (const pos of shuffledFloors) {
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
      } else {
        row.push('floor')
      }
    }
    terrain.push(row)
  }

  return {
    id: `eval-easy-fallback-${Date.now()}`,
    width,
    height,
    terrain,
    playerStart: { x: 2, y: 3 },
    boxStarts: [{ x: 4, y: 3, color: 'orange' }],
    goals: [{ x: 5, y: 3 }],
    difficulty: 'eval-easy' as Difficulty,
    fileSource: 'generated',
    puzzleNumber: 1,
    generationIterations: totalAttempts,
    usedFallback: true,
    optimalMoves: 1,
  }
}

/**
 * Generate an eval-easy level with sparse walls and simple solutions.
 */
export function generateEvalEasyLevel(): SokobanLevel {
  console.log('[EvalEasyGenerator] Starting generation...')

  for (let attempt = 1; attempt <= CONFIG.maxAttempts; attempt++) {
    // Random grid size
    const size = randomInt(CONFIG.minSize, CONFIG.maxSize)
    const width = size
    const height = size

    // Generate terrain (internal walls scaled based on size)
    const terrain = generateTerrain(width, height)

    // Random number of boxes
    const numBoxes = randomInt(CONFIG.minBoxes, CONFIG.maxBoxes)

    // Try to place entities
    const placement = tryPlaceEntities(terrain, numBoxes, width, height)
    if (!placement) {
      if (attempt % 100 === 0) {
        console.log(`[EvalEasyGenerator] Attempt ${attempt}: Failed to place entities`)
      }
      continue
    }

    const candidateLevel: SokobanLevel = {
      id: `eval-easy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      width,
      height,
      terrain: placement.terrain,
      playerStart: placement.playerPos,
      boxStarts: placement.boxes,
      goals: placement.goals,
      difficulty: 'eval-easy' as Difficulty,
      fileSource: 'generated',
      puzzleNumber: attempt,
    }

    // Verify with solver
    const solverResult = solvePuzzle(candidateLevel, CONFIG.maxSolverNodes)

    if (!solverResult.solvable) {
      if (attempt % 100 === 0) {
        console.log(`[EvalEasyGenerator] Attempt ${attempt}: Unsolvable`)
      }
      continue
    }

    if (solverResult.moveCount < CONFIG.minMoves) {
      if (attempt % 50 === 0) {
        console.log(
          `[EvalEasyGenerator] Attempt ${attempt}: Too trivial (${solverResult.moveCount} < ${CONFIG.minMoves} moves)`,
        )
      }
      continue
    }

    if (solverResult.moveCount > CONFIG.maxMoves) {
      if (attempt % 50 === 0) {
        console.log(
          `[EvalEasyGenerator] Attempt ${attempt}: Too hard (${solverResult.moveCount} > ${CONFIG.maxMoves} moves)`,
        )
      }
      continue
    }

    // Success!
    console.log(
      `[EvalEasyGenerator] SUCCESS! Found puzzle in ${attempt} attempts (${solverResult.moveCount} moves, ${numBoxes} boxes, ${size}x${size})`,
    )

    return {
      ...candidateLevel,
      optimalMoves: solverResult.moveCount,
      generationIterations: attempt,
    }
  }

  // Fallback
  console.log(
    `[EvalEasyGenerator] FALLBACK: No valid puzzle found after ${CONFIG.maxAttempts} attempts`,
  )
  return createFallbackPuzzle(CONFIG.maxAttempts)
}
