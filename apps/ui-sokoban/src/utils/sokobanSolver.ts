import type { MoveDirection, Position, SokobanLevel } from '../types'

export interface SolverResult {
  solvable: boolean
  solution: MoveDirection[] | null
  moveCount: number
  nodesExplored: number
  /** True if solver hit node limit without finding solution (puzzle may still be solvable) */
  hitLimit: boolean
}

interface SolverState {
  playerPos: Position
  boxes: Position[]
  moves: MoveDirection[]
}

const DIRECTIONS: { direction: MoveDirection; dx: number; dy: number }[] = [
  { direction: 'UP', dx: 0, dy: -1 },
  { direction: 'DOWN', dx: 0, dy: 1 },
  { direction: 'LEFT', dx: -1, dy: 0 },
  { direction: 'RIGHT', dx: 1, dy: 0 },
]

/**
 * Solve a Sokoban puzzle using BFS (Breadth-First Search).
 * Returns the optimal (shortest) solution if one exists.
 *
 * @param level - The Sokoban level to solve
 * @param maxNodes - Maximum nodes to explore before giving up (default: 50000)
 * @returns SolverResult with solution if found
 */
export function solvePuzzle(level: SokobanLevel, maxNodes = 50000): SolverResult {
  const initialState: SolverState = {
    playerPos: { ...level.playerStart },
    boxes: level.boxStarts.map((b) => ({ ...b })),
    moves: [],
  }

  // Check if already solved
  if (isGoalState(initialState.boxes, level)) {
    return {
      solvable: true,
      solution: [],
      moveCount: 0,
      nodesExplored: 1,
      hitLimit: false,
    }
  }

  const visited = new Set<string>()
  visited.add(stateToHash(initialState))

  const queue: SolverState[] = [initialState]
  let nodesExplored = 0

  while (queue.length > 0 && nodesExplored < maxNodes) {
    const current = queue.shift()
    if (!current) break
    nodesExplored++

    // Try each direction
    for (const { direction, dx, dy } of DIRECTIONS) {
      const newPlayerPos = {
        x: current.playerPos.x + dx,
        y: current.playerPos.y + dy,
      }

      // Check if player can move there
      if (!isValidCell(newPlayerPos, level)) continue

      // Check if there's a box at the new player position
      const boxIndex = findBoxAt(newPlayerPos, current.boxes)

      let newBoxes = current.boxes
      if (boxIndex !== -1) {
        // There's a box - try to push it
        const newBoxPos = {
          x: newPlayerPos.x + dx,
          y: newPlayerPos.y + dy,
        }

        // Check if box can be pushed there
        if (!isValidCell(newBoxPos, level)) continue
        if (findBoxAt(newBoxPos, current.boxes) !== -1) continue

        // Push is valid - create new box array
        newBoxes = current.boxes.map((b, i) => (i === boxIndex ? newBoxPos : b))

        // Deadlock detection: corner and line deadlocks
        if (isDeadlock(newBoxPos, level)) continue
      }

      const newState: SolverState = {
        playerPos: newPlayerPos,
        boxes: newBoxes,
        moves: [...current.moves, direction],
      }

      const hash = stateToHash(newState)
      if (visited.has(hash)) continue
      visited.add(hash)

      // Check if this is a goal state
      if (isGoalState(newBoxes, level)) {
        return {
          solvable: true,
          solution: newState.moves,
          moveCount: newState.moves.length,
          nodesExplored,
          hitLimit: false,
        }
      }

      queue.push(newState)
    }
  }

  // Determine if we hit the limit or exhausted all possibilities
  const hitLimit = nodesExplored >= maxNodes

  return {
    solvable: false,
    solution: null,
    moveCount: 0,
    nodesExplored,
    hitLimit,
  }
}

/**
 * Create a canonical hash string for a state.
 * Boxes are sorted to ensure same state produces same hash regardless of box order.
 */
function stateToHash(state: SolverState): string {
  const sortedBoxes = [...state.boxes].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y
    return a.x - b.x
  })
  const boxStr = sortedBoxes.map((b) => `${b.x},${b.y}`).join('|')
  return `${state.playerPos.x},${state.playerPos.y}:${boxStr}`
}

/**
 * Check if all boxes are on goal positions.
 */
function isGoalState(boxes: Position[], level: SokobanLevel): boolean {
  return boxes.every((box) => level.terrain[box.y]?.[box.x] === 'goal')
}

/**
 * Check if a position is a valid (non-wall) cell.
 */
function isValidCell(pos: Position, level: SokobanLevel): boolean {
  if (pos.x < 0 || pos.x >= level.width || pos.y < 0 || pos.y >= level.height) {
    return false
  }
  const cell = level.terrain[pos.y]?.[pos.x]
  return cell === 'floor' || cell === 'goal'
}

/**
 * Find the index of a box at the given position, or -1 if none.
 */
function findBoxAt(pos: Position, boxes: Position[]): number {
  return boxes.findIndex((b) => b.x === pos.x && b.y === pos.y)
}

/**
 * Check if a box is in a corner deadlock (stuck in corner, not on goal).
 */
function isCornerDeadlock(boxPos: Position, level: SokobanLevel): boolean {
  // If box is on a goal, it's not a deadlock
  if (level.terrain[boxPos.y]?.[boxPos.x] === 'goal') {
    return false
  }

  const up = { x: boxPos.x, y: boxPos.y - 1 }
  const down = { x: boxPos.x, y: boxPos.y + 1 }
  const left = { x: boxPos.x - 1, y: boxPos.y }
  const right = { x: boxPos.x + 1, y: boxPos.y }

  const wallUp = !isValidCell(up, level)
  const wallDown = !isValidCell(down, level)
  const wallLeft = !isValidCell(left, level)
  const wallRight = !isValidCell(right, level)

  // Corner deadlock: two perpendicular walls
  return (
    (wallUp && wallLeft) ||
    (wallUp && wallRight) ||
    (wallDown && wallLeft) ||
    (wallDown && wallRight)
  )
}

/**
 * Check if a box is in a line deadlock.
 * A line deadlock occurs when a box is against a wall and there's
 * no goal anywhere along that wall line.
 */
function isLineDeadlock(boxPos: Position, level: SokobanLevel): boolean {
  // If box is on a goal, it's not a deadlock
  if (level.terrain[boxPos.y]?.[boxPos.x] === 'goal') {
    return false
  }

  // Check if against horizontal wall (above or below)
  const wallAbove = !isValidCell({ x: boxPos.x, y: boxPos.y - 1 }, level)
  const wallBelow = !isValidCell({ x: boxPos.x, y: boxPos.y + 1 }, level)

  if (wallAbove || wallBelow) {
    // Scan the entire row for any goal
    const row = level.terrain[boxPos.y]
    if (row) {
      const hasGoalInRow = row.some((cell) => cell === 'goal')
      if (!hasGoalInRow) return true
    }
  }

  // Check if against vertical wall (left or right)
  const wallLeft = !isValidCell({ x: boxPos.x - 1, y: boxPos.y }, level)
  const wallRight = !isValidCell({ x: boxPos.x + 1, y: boxPos.y }, level)

  if (wallLeft || wallRight) {
    // Scan the entire column for any goal
    const hasGoalInCol = level.terrain.some((row) => row[boxPos.x] === 'goal')
    if (!hasGoalInCol) return true
  }

  return false
}

/**
 * Check if a box is in any deadlock state.
 */
function isDeadlock(boxPos: Position, level: SokobanLevel): boolean {
  return isCornerDeadlock(boxPos, level) || isLineDeadlock(boxPos, level)
}
