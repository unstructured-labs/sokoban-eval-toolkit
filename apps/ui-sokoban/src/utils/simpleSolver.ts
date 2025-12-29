import type { MoveDirection, Position, SokobanLevel } from '../types'

export interface SimpleSolverResult {
  solvable: boolean
  solution: MoveDirection[] | null
  moveCount: number
}

const DIRECTIONS: { dir: MoveDirection; dx: number; dy: number }[] = [
  { dir: 'UP', dx: 0, dy: -1 },
  { dir: 'DOWN', dx: 0, dy: 1 },
  { dir: 'LEFT', dx: -1, dy: 0 },
  { dir: 'RIGHT', dx: 1, dy: 0 },
]

/**
 * Simple BFS solver for easy Sokoban puzzles.
 * Includes deadlock detection for pruning (corner deadlocks, dead squares).
 * Limited to 50k states to prevent hanging.
 */
export function simpleSolve(level: SokobanLevel, maxStates = 50000): SimpleSolverResult {
  const goals = getGoals(level)

  if (goals.length === 0) {
    return { solvable: false, solution: null, moveCount: 0 }
  }

  // Precompute dead squares (positions where a box can never reach any goal)
  const deadSquares = computeDeadSquares(level, goals)

  const initialState = encodeState(level.playerStart, level.boxStarts)

  // Check if already solved
  if (isSolved(level.boxStarts, goals)) {
    return { solvable: true, solution: [], moveCount: 0 }
  }

  // Check if initial state has deadlock
  if (hasDeadlock(level.boxStarts, goals, deadSquares)) {
    return { solvable: false, solution: null, moveCount: 0 }
  }

  const visited = new Set<string>([initialState])
  const queue: { player: Position; boxes: Position[]; moves: MoveDirection[] }[] = [
    { player: { ...level.playerStart }, boxes: level.boxStarts.map((b) => ({ ...b })), moves: [] },
  ]

  let statesExplored = 0

  while (queue.length > 0 && statesExplored < maxStates) {
    const current = queue.shift()
    if (!current) break
    statesExplored++

    for (const { dir, dx, dy } of DIRECTIONS) {
      const newPlayerX = current.player.x + dx
      const newPlayerY = current.player.y + dy

      // Check if new player position is valid
      if (!isWalkable(newPlayerX, newPlayerY, level)) continue

      // Check if there's a box at the new position
      const boxIndex = current.boxes.findIndex((b) => b.x === newPlayerX && b.y === newPlayerY)

      let newBoxes = current.boxes

      if (boxIndex !== -1) {
        // There's a box - try to push it
        const newBoxX = newPlayerX + dx
        const newBoxY = newPlayerY + dy

        // Check if box can be pushed
        if (!isWalkable(newBoxX, newBoxY, level)) continue
        if (current.boxes.some((b) => b.x === newBoxX && b.y === newBoxY)) continue

        // Create new box state
        newBoxes = current.boxes.map((b, i) =>
          i === boxIndex ? { x: newBoxX, y: newBoxY } : { ...b },
        )

        // Check for deadlock after push
        if (hasDeadlock(newBoxes, goals, deadSquares)) continue
      }

      const newPlayer = { x: newPlayerX, y: newPlayerY }
      const stateKey = encodeState(newPlayer, newBoxes)

      if (visited.has(stateKey)) continue
      visited.add(stateKey)

      const newMoves = [...current.moves, dir]

      // Check if solved
      if (isSolved(newBoxes, goals)) {
        return { solvable: true, solution: newMoves, moveCount: newMoves.length }
      }

      queue.push({ player: newPlayer, boxes: newBoxes, moves: newMoves })
    }
  }

  return { solvable: false, solution: null, moveCount: 0 }
}

/**
 * Compute dead squares - positions where a box can never be pushed to any goal.
 * Uses reverse reachability: start from goals and find all squares a box can be pulled from.
 */
function computeDeadSquares(level: SokobanLevel, goals: Position[]): Set<string> {
  const validSquares = new Set<string>()

  // For each goal, do a reverse BFS to find all squares a box could be pushed from
  for (const goal of goals) {
    const visited = new Set<string>()
    const queue: Position[] = [goal]
    visited.add(`${goal.x},${goal.y}`)
    validSquares.add(`${goal.x},${goal.y}`)

    while (queue.length > 0) {
      const pos = queue.shift()
      if (!pos) break

      // Try pulling box from each direction (reverse of pushing)
      for (const { dx, dy } of DIRECTIONS) {
        // Box would be pulled from pos to (pos.x - dx, pos.y - dy)
        // Player would need to be at (pos.x + dx, pos.y + dy) and move to pos
        const pulledToX = pos.x - dx
        const pulledToY = pos.y - dy
        const playerFromX = pos.x + dx
        const playerFromY = pos.y + dy

        // Check if pull is valid
        if (!isWalkable(pulledToX, pulledToY, level)) continue
        if (!isWalkable(playerFromX, playerFromY, level)) continue

        const key = `${pulledToX},${pulledToY}`
        if (visited.has(key)) continue
        visited.add(key)
        validSquares.add(key)
        queue.push({ x: pulledToX, y: pulledToY })
      }
    }
  }

  // Dead squares are all walkable squares NOT in validSquares
  const deadSquares = new Set<string>()
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (isWalkable(x, y, level)) {
        const key = `${x},${y}`
        if (!validSquares.has(key)) {
          deadSquares.add(key)
        }
      }
    }
  }

  return deadSquares
}

/**
 * Check if any box is in a deadlock position.
 */
function hasDeadlock(boxes: Position[], goals: Position[], deadSquares: Set<string>): boolean {
  const goalSet = new Set(goals.map((g) => `${g.x},${g.y}`))

  for (const box of boxes) {
    const key = `${box.x},${box.y}`
    // Box on a goal is never a deadlock
    if (goalSet.has(key)) continue
    // Box on a dead square is always a deadlock
    if (deadSquares.has(key)) return true
  }

  return false
}

function getGoals(level: SokobanLevel): Position[] {
  const goals: Position[] = []
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (level.terrain[y]?.[x] === 'goal') {
        goals.push({ x, y })
      }
    }
  }
  return goals
}

function isWalkable(x: number, y: number, level: SokobanLevel): boolean {
  if (x < 0 || x >= level.width || y < 0 || y >= level.height) return false
  const cell = level.terrain[y]?.[x]
  return cell === 'floor' || cell === 'goal'
}

function isSolved(boxes: Position[], goals: Position[]): boolean {
  if (boxes.length !== goals.length) return false
  const goalSet = new Set(goals.map((g) => `${g.x},${g.y}`))
  return boxes.every((b) => goalSet.has(`${b.x},${b.y}`))
}

function encodeState(player: Position, boxes: Position[]): string {
  const sortedBoxes = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x)
  return `${player.x},${player.y}|${sortedBoxes.map((b) => `${b.x},${b.y}`).join(':')}`
}
