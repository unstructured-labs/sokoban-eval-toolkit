import type { CellTerrain, Position, SokobanLevel } from '@src/types'

interface GeneratorOptions {
  width?: number
  height?: number
  numBoxes?: number
  minPushes?: number
  maxAttempts?: number
}

const DEFAULT_OPTIONS: Required<GeneratorOptions> = {
  width: 8,
  height: 8,
  numBoxes: 1,
  minPushes: 3,
  maxAttempts: 100,
}

/**
 * Generate a simple solvable Sokoban puzzle.
 *
 * Strategy: Build puzzles that are guaranteed solvable by construction.
 * 1. Create an open room with walls on the border
 * 2. Place goal(s) in valid interior positions
 * 3. For each goal, trace a path backward to place box and ensure push path
 * 4. Place player where they can execute the solution
 */
export function generateEasyLevel(options: GeneratorOptions = {}): SokobanLevel {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const { width, height, numBoxes, minPushes, maxAttempts } = opts

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = tryGenerateLevel(width, height, numBoxes, minPushes)
    if (result) {
      return {
        ...result,
        id: `easy-generated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        difficulty: 'easy',
        fileSource: 'generated',
        puzzleNumber: attempt + 1,
      }
    }
  }

  // Fallback: return a trivial puzzle
  return createTrivialPuzzle(width, height)
}

function tryGenerateLevel(
  width: number,
  height: number,
  numBoxes: number,
  minPushes: number,
): Omit<SokobanLevel, 'id' | 'difficulty' | 'fileSource' | 'puzzleNumber'> | null {
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
  const numWalls = Math.floor(width * height * 0.1)
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
    const boxPath = generateBoxPath(terrain, goal, minPushes, width, height, boxes)
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
  minPushes: number,
  width: number,
  height: number,
  existingBoxes: Position[],
): { boxStart: Position } | null {
  // Trace backward from goal: find a path of `minPushes` pushes
  // Each step: box moves opposite to push direction

  let current = { ...goal }
  const directions = [
    { dx: 0, dy: -1 }, // up (box was pushed from below)
    { dx: 0, dy: 1 }, // down
    { dx: -1, dy: 0 }, // left
    { dx: 1, dy: 0 }, // right
  ]

  for (let push = 0; push < minPushes; push++) {
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
      // Can't extend path further, but might be enough
      if (push >= 1) break
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
  // Find a position adjacent to box that allows pushing toward goal
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

function createTrivialPuzzle(width: number, height: number): SokobanLevel {
  // Simple 1-push puzzle as fallback
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

  terrain[centerY][centerX + 1] = 'goal'

  return {
    id: `easy-trivial-${Date.now()}`,
    width,
    height,
    terrain,
    playerStart: { x: centerX - 1, y: centerY },
    boxStarts: [{ x: centerX, y: centerY }],
    goals: [{ x: centerX + 1, y: centerY }],
    difficulty: 'easy',
    fileSource: 'generated',
    puzzleNumber: 1,
  }
}
