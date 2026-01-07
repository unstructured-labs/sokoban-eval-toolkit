import type { MoveDirection, Position, SokobanLevel } from '../types'

export interface SolverResult {
  solvable: boolean
  solution: MoveDirection[] | null
  moveCount: number
  nodesExplored: number
  /** True if solver hit node limit without finding solution (puzzle may still be solvable) */
  hitLimit: boolean
}

/** A* Search Node - represents a state after a box push */
interface SearchNode {
  playerPos: Position
  boxes: Position[]
  /** g-score: number of moves (walks + pushes) taken so far */
  cost: number
  /** h-score: estimated moves to finish */
  heuristic: number
  /** f-score: cost + heuristic */
  priority: number
  /** Unique state hash */
  id: string
  /** For path reconstruction */
  parent: SearchNode | null
  /** The moves (walk + push) that got us here */
  actionFromParent: MoveDirection[] | null
}

/**
 * Min-Heap Priority Queue for A* search
 */
class PriorityQueue {
  private items: SearchNode[] = []

  push(item: SearchNode): void {
    this.items.push(item)
    this.bubbleUp(this.items.length - 1)
  }

  pop(): SearchNode | undefined {
    if (this.items.length === 0) return undefined
    const top = this.items[0]
    const bottom = this.items.pop()
    if (this.items.length > 0 && bottom) {
      this.items[0] = bottom
      this.sinkDown(0)
    }
    return top
  }

  size(): number {
    return this.items.length
  }

  private bubbleUp(startIndex: number): void {
    let index = startIndex
    const item = this.items[index]
    while (index > 0) {
      const parentIdx = Math.floor((index - 1) / 2)
      const parent = this.items[parentIdx]
      if (item.priority >= parent.priority) break
      this.items[index] = parent
      this.items[parentIdx] = item
      index = parentIdx
    }
  }

  private sinkDown(index: number): void {
    const length = this.items.length
    const element = this.items[index]
    let currentIndex = index
    while (true) {
      const leftChildIdx = 2 * currentIndex + 1
      const rightChildIdx = 2 * currentIndex + 2
      let swap: number | null = null

      if (leftChildIdx < length) {
        if (this.items[leftChildIdx].priority < element.priority) {
          swap = leftChildIdx
        }
      }
      if (rightChildIdx < length) {
        if (
          (swap === null && this.items[rightChildIdx].priority < element.priority) ||
          (swap !== null && this.items[rightChildIdx].priority < this.items[leftChildIdx].priority)
        ) {
          swap = rightChildIdx
        }
      }
      if (swap === null) break
      this.items[currentIndex] = this.items[swap]
      this.items[swap] = element
      currentIndex = swap
    }
  }
}

const PUSH_DIRECTIONS = [
  { dir: 'UP' as MoveDirection, dx: 0, dy: -1 },
  { dir: 'DOWN' as MoveDirection, dx: 0, dy: 1 },
  { dir: 'LEFT' as MoveDirection, dx: -1, dy: 0 },
  { dir: 'RIGHT' as MoveDirection, dx: 1, dy: 0 },
]

// Batch size for async solver - yield to UI every N nodes
const ASYNC_BATCH_SIZE = 1000

/**
 * Async version of solvePuzzle that yields to the UI periodically.
 * Prevents browser lockup during long solves.
 */
export async function solvePuzzleAsync(
  level: SokobanLevel,
  maxNodes = 150000,
): Promise<SolverResult> {
  const deadSquares = computeDeadSquares(level)
  const goals = findGoals(level)

  const initialBoxes = level.boxStarts.map((b) => ({ ...b }))

  if (isGoalState(initialBoxes, goals)) {
    return {
      solvable: true,
      solution: [],
      moveCount: 0,
      nodesExplored: 1,
      hitLimit: false,
    }
  }

  for (const box of initialBoxes) {
    if (deadSquares.has(`${box.x},${box.y}`)) {
      return failResult(1)
    }
  }

  const initialReachable = getReachableArea(level.playerStart, initialBoxes, level)
  const initialHash = generateStateHash(initialBoxes, initialReachable.canonicalPos)

  const startNode: SearchNode = {
    playerPos: level.playerStart,
    boxes: initialBoxes,
    cost: 0,
    heuristic: calcHeuristic(initialBoxes, goals),
    priority: 0,
    id: initialHash,
    parent: null,
    actionFromParent: null,
  }
  startNode.priority = startNode.cost + startNode.heuristic

  const queue = new PriorityQueue()
  queue.push(startNode)

  const visited = new Set<string>()
  visited.add(initialHash)

  let nodesExplored = 0
  let batchCount = 0

  while (queue.size() > 0 && nodesExplored < maxNodes) {
    const current = queue.pop()
    if (!current) break
    nodesExplored++
    batchCount++

    // Yield to UI every ASYNC_BATCH_SIZE nodes
    if (batchCount >= ASYNC_BATCH_SIZE) {
      batchCount = 0
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    if (current.heuristic === 0) {
      return {
        solvable: true,
        solution: reconstructPath(current),
        moveCount: reconstructPath(current).length,
        nodesExplored,
        hitLimit: false,
      }
    }

    const reachable = getReachableArea(current.playerPos, current.boxes, level)

    for (let i = 0; i < current.boxes.length; i++) {
      const box = current.boxes[i]

      for (const { dir, dx, dy } of PUSH_DIRECTIONS) {
        const pushFrom = { x: box.x - dx, y: box.y - dy }
        if (!reachable.map.has(`${pushFrom.x},${pushFrom.y}`)) continue

        const targetPos = { x: box.x + dx, y: box.y + dy }
        if (!isValidMoveTarget(targetPos, level, current.boxes)) continue
        if (deadSquares.has(`${targetPos.x},${targetPos.y}`)) continue

        const newBoxes = [...current.boxes]
        newBoxes[i] = targetPos

        if (isFreezeDeadlock(newBoxes, level)) continue

        const walkPath = findPathBFS(current.playerPos, pushFrom, level, current.boxes)
        if (!walkPath) continue

        const moveSequence = [...walkPath, dir]
        const playerAfterPush = { x: box.x, y: box.y }
        const newReachable = getReachableArea(playerAfterPush, newBoxes, level)
        const newHash = generateStateHash(newBoxes, newReachable.canonicalPos)

        if (visited.has(newHash)) continue
        visited.add(newHash)

        const h = calcHeuristic(newBoxes, goals)
        const g = current.cost + moveSequence.length

        queue.push({
          playerPos: playerAfterPush,
          boxes: newBoxes,
          cost: g,
          heuristic: h,
          priority: g + h,
          id: newHash,
          parent: current,
          actionFromParent: moveSequence,
        })
      }
    }
  }

  return failResult(nodesExplored, nodesExplored >= maxNodes)
}

/**
 * Solve a Sokoban puzzle using Push-Level A* Search.
 *
 * Unlike Move-Level BFS which treats every player step as a state change,
 * this solver only creates new states when a box is pushed. Walking between
 * pushes is calculated but doesn't expand the search space.
 *
 * Uses Manhattan distance heuristic to prioritize pushing boxes toward goals.
 *
 * @param level - The Sokoban level to solve
 * @param maxNodes - Maximum nodes to explore before giving up (default: 150000)
 * @returns SolverResult with solution if found
 */
export function solvePuzzle(level: SokobanLevel, maxNodes = 150000): SolverResult {
  const deadSquares = computeDeadSquares(level)
  const goals = findGoals(level)

  // Initial state
  const initialBoxes = level.boxStarts.map((b) => ({ ...b }))

  // Check if already solved
  if (isGoalState(initialBoxes, goals)) {
    return {
      solvable: true,
      solution: [],
      moveCount: 0,
      nodesExplored: 1,
      hitLimit: false,
    }
  }

  // Check immediate failures - boxes on dead squares
  for (const box of initialBoxes) {
    if (deadSquares.has(`${box.x},${box.y}`)) {
      return failResult(1)
    }
  }

  // Get initial reachability for state normalization
  const initialReachable = getReachableArea(level.playerStart, initialBoxes, level)
  const initialHash = generateStateHash(initialBoxes, initialReachable.canonicalPos)

  const startNode: SearchNode = {
    playerPos: level.playerStart,
    boxes: initialBoxes,
    cost: 0,
    heuristic: calcHeuristic(initialBoxes, goals),
    priority: 0,
    id: initialHash,
    parent: null,
    actionFromParent: null,
  }
  startNode.priority = startNode.cost + startNode.heuristic

  const queue = new PriorityQueue()
  queue.push(startNode)

  const visited = new Set<string>()
  visited.add(initialHash)

  let nodesExplored = 0

  while (queue.size() > 0 && nodesExplored < maxNodes) {
    const current = queue.pop()
    if (!current) break
    nodesExplored++

    // Check if solved (heuristic of 0 means all boxes on goals)
    if (current.heuristic === 0) {
      return {
        solvable: true,
        solution: reconstructPath(current),
        moveCount: reconstructPath(current).length,
        nodesExplored,
        hitLimit: false,
      }
    }

    // Get reachable area from current position
    const reachable = getReachableArea(current.playerPos, current.boxes, level)

    // Find all possible pushes from this reachable area
    for (let i = 0; i < current.boxes.length; i++) {
      const box = current.boxes[i]

      // Try pushing this box in all 4 directions
      for (const { dir, dx, dy } of PUSH_DIRECTIONS) {
        // Position player must be at to push box in this direction
        const pushFrom = { x: box.x - dx, y: box.y - dy }

        // Can the player reach the push position?
        if (!reachable.map.has(`${pushFrom.x},${pushFrom.y}`)) continue

        // Where would the box end up?
        const targetPos = { x: box.x + dx, y: box.y + dy }

        // Is the target position valid (floor/goal and empty)?
        if (!isValidMoveTarget(targetPos, level, current.boxes)) continue

        // Check static deadlocks (dead squares)
        if (deadSquares.has(`${targetPos.x},${targetPos.y}`)) continue

        // Create new box state
        const newBoxes = [...current.boxes]
        newBoxes[i] = targetPos

        // Check dynamic deadlocks (freeze patterns)
        if (isFreezeDeadlock(newBoxes, level)) continue

        // Calculate walking path to push position
        const walkPath = findPathBFS(current.playerPos, pushFrom, level, current.boxes)
        if (!walkPath) continue

        // Full move sequence: walk to box + push
        const moveSequence = [...walkPath, dir]

        // After push, player is at box's old position
        const playerAfterPush = { x: box.x, y: box.y }
        const newReachable = getReachableArea(playerAfterPush, newBoxes, level)
        const newHash = generateStateHash(newBoxes, newReachable.canonicalPos)

        if (visited.has(newHash)) continue
        visited.add(newHash)

        const h = calcHeuristic(newBoxes, goals)
        const g = current.cost + moveSequence.length

        queue.push({
          playerPos: playerAfterPush,
          boxes: newBoxes,
          cost: g,
          heuristic: h,
          priority: g + h,
          id: newHash,
          parent: current,
          actionFromParent: moveSequence,
        })
      }
    }
  }

  return failResult(nodesExplored, nodesExplored >= maxNodes)
}

/**
 * Reconstruct the full move path from start to goal
 */
function reconstructPath(node: SearchNode): MoveDirection[] {
  const path: MoveDirection[] = []
  let curr: SearchNode | null = node
  while (curr?.parent) {
    if (curr.actionFromParent) {
      path.unshift(...curr.actionFromParent)
    }
    curr = curr.parent
  }
  return path
}

function failResult(nodes: number, hitLimit = false): SolverResult {
  return {
    solvable: false,
    solution: null,
    moveCount: 0,
    nodesExplored: nodes,
    hitLimit,
  }
}

/**
 * Find all squares the player can reach without pushing any boxes.
 * Returns a Set of position keys and a canonical position (top-left most) for state hashing.
 */
function getReachableArea(
  start: Position,
  boxes: Position[],
  level: SokobanLevel,
): { map: Set<string>; canonicalPos: Position } {
  const visited = new Set<string>()
  const queue = [start]
  visited.add(`${start.x},${start.y}`)

  // Canonical position: lowest Y, then lowest X
  let minPos = { x: start.x, y: start.y }

  // Box positions for fast lookup
  const boxKeys = new Set(boxes.map((b) => `${b.x},${b.y}`))

  while (queue.length > 0) {
    const curr = queue.shift()
    if (!curr) break

    // Update canonical if this position is "smaller"
    if (curr.y < minPos.y || (curr.y === minPos.y && curr.x < minPos.x)) {
      minPos = { x: curr.x, y: curr.y }
    }

    const dirs = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ]
    for (const d of dirs) {
      const nx = curr.x + d.x
      const ny = curr.y + d.y
      const key = `${nx},${ny}`

      if (!visited.has(key)) {
        if (nx >= 0 && nx < level.width && ny >= 0 && ny < level.height) {
          const cell = level.terrain[ny]?.[nx]
          if (cell !== 'wall' && cell !== undefined && !boxKeys.has(key)) {
            visited.add(key)
            queue.push({ x: nx, y: ny })
          }
        }
      }
    }
  }

  return { map: visited, canonicalPos: minPos }
}

/**
 * BFS to find walking path from A to B (no pushing)
 */
function findPathBFS(
  from: Position,
  to: Position,
  level: SokobanLevel,
  boxes: Position[],
): MoveDirection[] | null {
  if (from.x === to.x && from.y === to.y) return []

  const boxKeys = new Set(boxes.map((b) => `${b.x},${b.y}`))
  const queue: { pos: Position; path: MoveDirection[] }[] = [{ pos: from, path: [] }]
  const visited = new Set<string>([`${from.x},${from.y}`])

  while (queue.length > 0) {
    const item = queue.shift()
    if (!item) break
    const { pos, path } = item

    if (pos.x === to.x && pos.y === to.y) return path

    const moves: { d: MoveDirection; dx: number; dy: number }[] = [
      { d: 'UP', dx: 0, dy: -1 },
      { d: 'DOWN', dx: 0, dy: 1 },
      { d: 'LEFT', dx: -1, dy: 0 },
      { d: 'RIGHT', dx: 1, dy: 0 },
    ]

    for (const m of moves) {
      const nx = pos.x + m.dx
      const ny = pos.y + m.dy
      const key = `${nx},${ny}`

      if (!visited.has(key)) {
        if (nx >= 0 && nx < level.width && ny >= 0 && ny < level.height) {
          const cell = level.terrain[ny]?.[nx]
          if (cell !== 'wall' && cell !== undefined && !boxKeys.has(key)) {
            visited.add(key)
            queue.push({ pos: { x: nx, y: ny }, path: [...path, m.d] })
          }
        }
      }
    }
  }
  return null
}

/**
 * Generate a canonical state hash.
 * Uses sorted box positions and normalized player position (canonical reachable square).
 */
function generateStateHash(boxes: Position[], playerCanonical: Position): string {
  const sorted = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x)
  const boxStr = sorted.map((b) => `${b.x},${b.y}`).join(':')
  return `${playerCanonical.x},${playerCanonical.y}|${boxStr}`
}

/**
 * Heuristic: Sum of Manhattan distances from each box to its nearest goal.
 * Returns 0 when all boxes are on goals.
 */
function calcHeuristic(boxes: Position[], goals: Position[]): number {
  let total = 0
  for (const box of boxes) {
    let minDist = Number.POSITIVE_INFINITY
    for (const goal of goals) {
      const dist = Math.abs(box.x - goal.x) + Math.abs(box.y - goal.y)
      if (dist < minDist) minDist = dist
    }
    total += minDist
  }
  return total
}

/**
 * Find all goal positions in the level.
 */
function findGoals(level: SokobanLevel): Position[] {
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

/**
 * Check if all boxes are on goal positions.
 */
function isGoalState(boxes: Position[], goals: Position[]): boolean {
  const goalSet = new Set(goals.map((g) => `${g.x},${g.y}`))
  return boxes.every((box) => goalSet.has(`${box.x},${box.y}`))
}

/**
 * Check if a position is a valid move target (floor/goal and not occupied by a box).
 */
function isValidMoveTarget(pos: Position, level: SokobanLevel, currentBoxes: Position[]): boolean {
  if (pos.x < 0 || pos.x >= level.width || pos.y < 0 || pos.y >= level.height) return false
  const cell = level.terrain[pos.y]?.[pos.x]
  if (cell !== 'floor' && cell !== 'goal') return false
  return !currentBoxes.some((b) => b.x === pos.x && b.y === pos.y)
}

// ============================================================================
// DEADLOCK DETECTION (retained from original implementation)
// ============================================================================

/**
 * Precompute all "dead squares" - positions where a box can never be part of a solution.
 * A square is dead if:
 * 1. It's not a goal
 * 2. It forms a corner with walls (box would be stuck)
 *
 * Returns a Set of position keys "x,y" for O(1) lookup.
 */
function computeDeadSquares(level: SokobanLevel): Set<string> {
  const deadSquares = new Set<string>()

  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const cell = level.terrain[y]?.[x]

      // Skip walls and goals
      if (cell === 'wall' || cell === 'goal') continue

      // Skip non-floor cells
      if (cell !== 'floor') continue

      // Check if this floor cell is a dead square (corner)
      const pos = { x, y }
      if (isCornerWithWalls(pos, level)) {
        deadSquares.add(`${x},${y}`)
      }
    }
  }

  // Also mark squares along walls that lead only to dead corners (simple dead lanes)
  expandDeadLanes(deadSquares, level)

  return deadSquares
}

/**
 * Check if a position forms a corner with walls.
 */
function isCornerWithWalls(pos: Position, level: SokobanLevel): boolean {
  const up = level.terrain[pos.y - 1]?.[pos.x]
  const down = level.terrain[pos.y + 1]?.[pos.x]
  const left = level.terrain[pos.y]?.[pos.x - 1]
  const right = level.terrain[pos.y]?.[pos.x + 1]

  const wallUp = up === 'wall' || up === undefined
  const wallDown = down === 'wall' || down === undefined
  const wallLeft = left === 'wall' || left === undefined
  const wallRight = right === 'wall' || right === undefined

  return (
    (wallUp && wallLeft) ||
    (wallUp && wallRight) ||
    (wallDown && wallLeft) ||
    (wallDown && wallRight)
  )
}

/**
 * Expand dead squares along wall edges that have no goals.
 * If a box is pushed along a wall and there's no goal along that wall segment,
 * and both ends are corners/walls, the entire segment is dead.
 */
function expandDeadLanes(deadSquares: Set<string>, level: SokobanLevel): void {
  // Check horizontal lanes along top and bottom walls
  for (let y = 1; y < level.height - 1; y++) {
    let hasWallAbove = true
    let hasWallBelow = true
    let hasGoalInRow = false
    let rowStart = -1
    let rowEnd = -1

    for (let x = 0; x < level.width; x++) {
      const cell = level.terrain[y]?.[x]
      if (cell === 'floor' || cell === 'goal') {
        if (rowStart === -1) rowStart = x
        rowEnd = x
        if (cell === 'goal') hasGoalInRow = true

        const above = level.terrain[y - 1]?.[x]
        const below = level.terrain[y + 1]?.[x]
        if (above !== 'wall') hasWallAbove = false
        if (below !== 'wall') hasWallBelow = false
      }
    }

    // If entire row has wall above or below and no goals, mark non-corner cells as dead
    if ((hasWallAbove || hasWallBelow) && !hasGoalInRow && rowStart !== -1) {
      const leftEnd = deadSquares.has(`${rowStart},${y}`)
      const rightEnd = deadSquares.has(`${rowEnd},${y}`)

      if (leftEnd && rightEnd) {
        for (let x = rowStart; x <= rowEnd; x++) {
          const cell = level.terrain[y]?.[x]
          if (cell === 'floor') {
            deadSquares.add(`${x},${y}`)
          }
        }
      }
    }
  }

  // Check vertical lanes along left and right walls
  for (let x = 1; x < level.width - 1; x++) {
    let hasWallLeft = true
    let hasWallRight = true
    let hasGoalInCol = false
    let colStart = -1
    let colEnd = -1

    for (let y = 0; y < level.height; y++) {
      const cell = level.terrain[y]?.[x]
      if (cell === 'floor' || cell === 'goal') {
        if (colStart === -1) colStart = y
        colEnd = y
        if (cell === 'goal') hasGoalInCol = true

        const left = level.terrain[y]?.[x - 1]
        const right = level.terrain[y]?.[x + 1]
        if (left !== 'wall') hasWallLeft = false
        if (right !== 'wall') hasWallRight = false
      }
    }

    if ((hasWallLeft || hasWallRight) && !hasGoalInCol && colStart !== -1) {
      const topEnd = deadSquares.has(`${x},${colStart}`)
      const bottomEnd = deadSquares.has(`${x},${colEnd}`)

      if (topEnd && bottomEnd) {
        for (let y = colStart; y <= colEnd; y++) {
          const cell = level.terrain[y]?.[x]
          if (cell === 'floor') {
            deadSquares.add(`${x},${y}`)
          }
        }
      }
    }
  }
}

/**
 * Check for freeze deadlock - a 2x2 area where boxes/walls form an immovable block.
 * Returns true if the current box configuration creates a freeze deadlock.
 */
function isFreezeDeadlock(boxes: Position[], level: SokobanLevel): boolean {
  const boxSet = new Set(boxes.map((b) => `${b.x},${b.y}`))

  // Check all 2x2 squares that contain any box
  for (const box of boxes) {
    // Check all four 2x2 squares that include this box
    const offsets = [
      { dx: 0, dy: 0 }, // box is top-left
      { dx: -1, dy: 0 }, // box is top-right
      { dx: 0, dy: -1 }, // box is bottom-left
      { dx: -1, dy: -1 }, // box is bottom-right
    ]

    for (const { dx, dy } of offsets) {
      const topLeft = { x: box.x + dx, y: box.y + dy }

      // Get all 4 cells of this 2x2 square
      const cells = [
        { x: topLeft.x, y: topLeft.y },
        { x: topLeft.x + 1, y: topLeft.y },
        { x: topLeft.x, y: topLeft.y + 1 },
        { x: topLeft.x + 1, y: topLeft.y + 1 },
      ]

      // Count boxes and walls, track if any box is on a goal
      let boxCount = 0
      let wallCount = 0
      let allBoxesOnGoals = true

      for (const cell of cells) {
        const terrain = level.terrain[cell.y]?.[cell.x]
        const isBox = boxSet.has(`${cell.x},${cell.y}`)

        if (terrain === 'wall' || terrain === undefined) {
          wallCount++
        } else if (isBox) {
          boxCount++
          if (terrain !== 'goal') {
            allBoxesOnGoals = false
          }
        }
      }

      // Freeze deadlock: 2x2 is filled with boxes/walls and not all boxes are on goals
      // Need at least 2 boxes for a freeze (1 box + walls is a corner, already detected)
      if (boxCount + wallCount === 4 && boxCount >= 2 && !allBoxesOnGoals) {
        return true
      }
    }
  }

  return false
}
