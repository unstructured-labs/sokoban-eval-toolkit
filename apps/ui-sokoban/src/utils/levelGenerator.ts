import type { CellTerrain, Position, SokobanLevel } from '../types'
import { solvePuzzle } from './sokobanSolver'

interface GeneratorOptions {
  width?: number
  height?: number
  numBoxes?: number
  minSolutionLength?: number
  maxSolutionLength?: number
  maxAttempts?: number
}

const DEFAULT_OPTIONS: Required<GeneratorOptions> = {
  width: 8,
  height: 8,
  numBoxes: 2,
  minSolutionLength: 5,
  maxSolutionLength: 15,
  maxAttempts: 200,
}

/**
 * Generate a solvable Sokoban puzzle with verified optimal solution.
 *
 * Strategy:
 * 1. Create an open room with walls on the border
 * 2. Place goal(s) in valid interior positions
 * 3. For each goal, trace a path backward to place box and ensure push path
 * 4. Place player where they can execute the solution
 * 5. Verify with BFS solver and ensure solution length is within range
 */
export function generateEasyLevel(options: GeneratorOptions = {}): SokobanLevel {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const { width, height, numBoxes, minSolutionLength, maxSolutionLength, maxAttempts } = opts

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = tryGenerateLevel(width, height, numBoxes)
    if (!result) continue

    const candidateLevel: SokobanLevel = {
      ...result,
      id: `easy-generated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      difficulty: 'easy',
      fileSource: 'generated',
      puzzleNumber: attempt + 1,
    }

    // Verify with solver
    const solverResult = solvePuzzle(candidateLevel, 50000)

    if (!solverResult.solvable) continue
    if (solverResult.moveCount < minSolutionLength) continue
    if (solverResult.moveCount > maxSolutionLength) continue

    // Valid puzzle - add optimal moves and return
    return {
      ...candidateLevel,
      optimalMoves: solverResult.moveCount,
    }
  }

  // Fallback: return a simple 2-box puzzle
  return createFallbackPuzzle(width, height)
}

function tryGenerateLevel(
  width: number,
  height: number,
  numBoxes: number,
): Omit<SokobanLevel, 'id' | 'difficulty' | 'fileSource' | 'puzzleNumber' | 'optimalMoves'> | null {
  // Create terrain with walls on border, floor inside
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

  // Add some random internal walls for interest (but not too many)
  const numWalls = Math.floor(width * height * 0.08)
  for (let i = 0; i < numWalls; i++) {
    const x = randomInt(2, width - 3)
    const y = randomInt(2, height - 3)
    terrain[y][x] = 'wall'
  }

  // Pick goal positions (interior, not adjacent to border)
  const goals: Position[] = []
  const boxes: Position[] = []

  for (let i = 0; i < numBoxes; i++) {
    const goal = findValidGoalPosition(terrain, goals, width, height)
    if (!goal) return null
    goals.push(goal)
    terrain[goal.y][goal.x] = 'goal'

    // Find a valid box starting position (can be pushed to goal)
    const boxPath = generateBoxPath(terrain, goal, width, height, boxes)
    if (!boxPath) return null

    boxes.push(boxPath.boxStart)
  }

  // Find player position (can push first box)
  const playerPos = findPlayerPosition(terrain, boxes[0], width, height, boxes)
  if (!playerPos) return null

  // Restore goals in terrain (they might have been marked during path finding)
  for (const goal of goals) {
    terrain[goal.y][goal.x] = 'goal'
  }

  return {
    width,
    height,
    terrain,
    playerStart: playerPos,
    boxStarts: boxes,
    goals,
  }
}

function findValidGoalPosition(
  terrain: CellTerrain[][],
  existingGoals: Position[],
  width: number,
  height: number,
): Position | null {
  const attempts = 50
  for (let i = 0; i < attempts; i++) {
    const x = randomInt(2, width - 3)
    const y = randomInt(2, height - 3)

    if (terrain[y][x] !== 'floor') continue
    if (existingGoals.some((g) => g.x === x && g.y === y)) continue

    // Ensure at least 2 adjacent floor cells (for pushing)
    const adjacent = getAdjacentFloors(terrain, { x, y }, width, height)
    if (adjacent.length >= 2) {
      return { x, y }
    }
  }
  return null
}

function generateBoxPath(
  terrain: CellTerrain[][],
  goal: Position,
  width: number,
  height: number,
  existingBoxes: Position[],
): { boxStart: Position } | null {
  // Trace backward from goal: find a position for the box
  // Box should be 2-4 pushes away from goal
  const minDistance = 2
  const maxDistance = 4

  let current = { ...goal }
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ]

  const targetPushes = randomInt(minDistance, maxDistance)

  for (let push = 0; push < targetPushes; push++) {
    // Shuffle directions for variety
    const shuffled = [...directions].sort(() => Math.random() - 0.5)
    let moved = false

    for (const dir of shuffled) {
      const newBox = { x: current.x + dir.dx, y: current.y + dir.dy }
      const playerWas = { x: newBox.x + dir.dx, y: newBox.y + dir.dy }

      // Check if this reverse-push is valid
      if (!isValidPosition(newBox, terrain, width, height)) continue
      if (!isValidPosition(playerWas, terrain, width, height)) continue
      if (existingBoxes.some((b) => b.x === newBox.x && b.y === newBox.y)) continue

      current = newBox
      moved = true
      break
    }

    if (!moved) {
      // Can't extend path further
      if (push >= minDistance - 1) break
      return null
    }
  }

  // Ensure box start isn't on goal
  if (current.x === goal.x && current.y === goal.y) return null

  return { boxStart: current }
}

function findPlayerPosition(
  terrain: CellTerrain[][],
  firstBox: Position,
  width: number,
  height: number,
  allBoxes: Position[],
): Position | null {
  // Player needs to be positioned to push the first box
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ]

  const shuffled = [...directions].sort(() => Math.random() - 0.5)

  for (const dir of shuffled) {
    // Player position is opposite to push direction
    const playerPos = { x: firstBox.x - dir.dx, y: firstBox.y - dir.dy }

    if (!isValidPosition(playerPos, terrain, width, height)) continue
    if (allBoxes.some((b) => b.x === playerPos.x && b.y === playerPos.y)) continue

    return playerPos
  }

  // Fallback: any valid floor position not occupied
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (terrain[y][x] === 'floor' || terrain[y][x] === 'goal') {
        if (!allBoxes.some((b) => b.x === x && b.y === y)) {
          return { x, y }
        }
      }
    }
  }

  return null
}

function isValidPosition(
  pos: Position,
  terrain: CellTerrain[][],
  width: number,
  height: number,
): boolean {
  if (pos.x < 1 || pos.x >= width - 1 || pos.y < 1 || pos.y >= height - 1) {
    return false
  }
  const cell = terrain[pos.y]?.[pos.x]
  return cell === 'floor' || cell === 'goal'
}

function getAdjacentFloors(
  terrain: CellTerrain[][],
  pos: Position,
  width: number,
  height: number,
): Position[] {
  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ]
  return dirs
    .map((d) => ({ x: pos.x + d.dx, y: pos.y + d.dy }))
    .filter((p) => isValidPosition(p, terrain, width, height))
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function createFallbackPuzzle(width: number, height: number): SokobanLevel {
  // Create a simple but non-trivial 2-box puzzle
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

  // Place two goals
  terrain[centerY - 1][centerX + 2] = 'goal'
  terrain[centerY + 1][centerX + 2] = 'goal'

  const level: SokobanLevel = {
    id: `easy-fallback-${Date.now()}`,
    width,
    height,
    terrain,
    playerStart: { x: centerX - 2, y: centerY },
    boxStarts: [
      { x: centerX, y: centerY - 1 },
      { x: centerX, y: centerY + 1 },
    ],
    goals: [
      { x: centerX + 2, y: centerY - 1 },
      { x: centerX + 2, y: centerY + 1 },
    ],
    difficulty: 'easy',
    fileSource: 'generated',
    puzzleNumber: 1,
  }

  // Calculate optimal moves for fallback
  const result = solvePuzzle(level)
  if (result.solvable) {
    level.optimalMoves = result.moveCount
  }

  return level
}
