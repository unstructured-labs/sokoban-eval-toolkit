import type { Box, GameState, MoveDirection, Position, SokobanLevel } from '../types'

export interface SimpleSolverResult {
  solvable: boolean
  solution: MoveDirection[] | null
  moveCount: number
}

export interface ColoredSolverResult {
  solvable: boolean
  solution: MoveDirection[] | null
  moveCount: number
  statesExplored: number
  maxDepthReached: number
}

/**
 * Check if a box at a given position would be adjacent to another box of the same color.
 */
function hasSameColorAdjacency(newBox: Box, boxes: Box[], excludeIndex?: number): boolean {
  const adjacentPositions = [
    { x: newBox.x, y: newBox.y - 1 },
    { x: newBox.x, y: newBox.y + 1 },
    { x: newBox.x - 1, y: newBox.y },
    { x: newBox.x + 1, y: newBox.y },
  ]

  for (let i = 0; i < boxes.length; i++) {
    if (i === excludeIndex) continue
    const otherBox = boxes[i]
    if (otherBox.color === newBox.color) {
      for (const adj of adjacentPositions) {
        if (otherBox.x === adj.x && otherBox.y === adj.y) {
          return true
        }
      }
    }
  }
  return false
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

/**
 * Encode state for colored variant (box positions with colors, no player position).
 * Player position doesn't matter for macro-move solver since we compute reachability.
 */
function encodeColoredBoxState(boxes: Box[]): string {
  const sortedBoxes = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x)
  return sortedBoxes.map((b) => `${b.x},${b.y},${b.color}`).join(':')
}

/**
 * Compute all positions the player can reach from current position (flood fill).
 * Returns a Set of "x,y" strings for quick lookup.
 */
function computePlayerReachability(
  playerPos: Position,
  boxes: Box[],
  level: SokobanLevel,
): Set<string> {
  const reachable = new Set<string>()
  const boxSet = new Set(boxes.map((b) => `${b.x},${b.y}`))
  const queue: Position[] = [playerPos]
  reachable.add(`${playerPos.x},${playerPos.y}`)

  while (queue.length > 0) {
    const pos = queue.shift()!
    for (const { dx, dy } of DIRECTIONS) {
      const nx = pos.x + dx
      const ny = pos.y + dy
      const key = `${nx},${ny}`

      if (reachable.has(key)) continue
      if (!isWalkable(nx, ny, level)) continue
      if (boxSet.has(key)) continue

      reachable.add(key)
      queue.push({ x: nx, y: ny })
    }
  }

  return reachable
}

/**
 * Check if colored puzzle is solved (all boxes on goals).
 */
function isColoredSolved(boxes: Box[], goals: Position[]): boolean {
  if (boxes.length !== goals.length) return false
  const goalSet = new Set(goals.map((g) => `${g.x},${g.y}`))
  return boxes.every((b) => goalSet.has(`${b.x},${b.y}`))
}

/**
 * Generate all valid goal configurations for colored boxes.
 * Each configuration places all boxes on goals while respecting same-color adjacency.
 */
function generateValidGoalConfigurations(boxes: Box[], goals: Position[]): Box[][] {
  const configurations: Box[][] = []
  const colors = boxes.map((b) => b.color)

  // Generate all permutations of goal assignments
  function permute(goalIndices: number[], used: boolean[], depth: number) {
    if (depth === boxes.length) {
      // Create box configuration from this permutation
      const config: Box[] = goalIndices.map((goalIdx, boxIdx) => ({
        x: goals[goalIdx].x,
        y: goals[goalIdx].y,
        color: colors[boxIdx],
      }))

      // Check same-color adjacency constraint
      let valid = true
      for (let i = 0; i < config.length && valid; i++) {
        if (hasSameColorAdjacency(config[i], config, i)) {
          valid = false
        }
      }

      if (valid) {
        configurations.push(config)
      }
      return
    }

    for (let i = 0; i < goals.length; i++) {
      if (!used[i]) {
        used[i] = true
        goalIndices.push(i)
        permute(goalIndices, used, depth + 1)
        goalIndices.pop()
        used[i] = false
      }
    }
  }

  permute([], new Array(goals.length).fill(false), 0)
  return configurations
}

/**
 * Find all possible "pull" moves from a state (reverse of push).
 * A pull: player is adjacent to box, moves away, box follows into player's old position.
 */
function findAllPossiblePulls(
  playerPos: Position,
  boxes: Box[],
  level: SokobanLevel,
): { boxIndex: number; newBox: Box; newPlayerPos: Position }[] {
  const reachable = computePlayerReachability(playerPos, boxes, level)
  const pulls: { boxIndex: number; newBox: Box; newPlayerPos: Position }[] = []

  // For each position the player can reach
  for (const posKey of reachable) {
    const [px, py] = posKey.split(',').map(Number)

    // Check each direction for a box to pull
    for (const { dx, dy } of DIRECTIONS) {
      const boxX = px + dx
      const boxY = py + dy

      // Find box at this position
      const boxIndex = boxes.findIndex((b) => b.x === boxX && b.y === boxY)
      if (boxIndex === -1) continue

      // Player needs to move in opposite direction (away from box)
      const newPlayerX = px - dx
      const newPlayerY = py - dy

      // Check if player can move there
      if (!isWalkable(newPlayerX, newPlayerY, level)) continue
      if (boxes.some((b) => b.x === newPlayerX && b.y === newPlayerY)) continue

      // Box moves to player's old position
      const newBox: Box = { x: px, y: py, color: boxes[boxIndex].color }

      // Check same-color adjacency for the pulled box
      if (hasSameColorAdjacency(newBox, boxes, boxIndex)) continue

      pulls.push({
        boxIndex,
        newBox,
        newPlayerPos: { x: newPlayerX, y: newPlayerY },
      })
    }
  }

  return pulls
}

/**
 * Backward search solver for colored Sokoban.
 * Starts from all valid goal configurations and searches backward using "pull" moves.
 * Builds a transposition table of all states reachable from goals.
 */
export async function coloredSolve(
  state: GameState,
  maxStates = 10000,
  onProgress?: (statesExplored: number, maxDepth: number, phase: string) => void,
  abortSignal?: { aborted: boolean },
): Promise<ColoredSolverResult> {
  const level = state.level
  const goals = getGoals(level)

  if (goals.length === 0 || goals.length !== state.boxes.length) {
    return { solvable: false, solution: null, moveCount: 0, statesExplored: 0, maxDepthReached: 0 }
  }

  const startBoxes: Box[] = state.boxes.map((b) => ({ x: b.x, y: b.y, color: b.color }))
  const initialStateKey = encodeColoredBoxState(startBoxes)

  // Check if already solved
  if (isColoredSolved(startBoxes, goals)) {
    return { solvable: true, solution: [], moveCount: 0, statesExplored: 1, maxDepthReached: 0 }
  }

  // Generate all valid goal configurations
  onProgress?.(0, 0, 'Generating goal configurations...')
  const goalConfigs = generateValidGoalConfigurations(startBoxes, goals)

  if (goalConfigs.length === 0) {
    return { solvable: false, solution: null, moveCount: 0, statesExplored: 0, maxDepthReached: 0 }
  }

  // Transposition table: state -> minimum pulls from goal
  const transposition = new Map<string, number>()

  interface SearchState {
    playerPos: Position
    boxes: Box[]
    pullCount: number
  }

  // Initialize queue with all goal configurations
  // For each goal config, player can be anywhere reachable
  const queue: SearchState[] = []

  for (const goalConfig of goalConfigs) {
    const stateKey = encodeColoredBoxState(goalConfig)
    if (!transposition.has(stateKey)) {
      transposition.set(stateKey, 0)

      // Player could be at any walkable position not occupied by a box
      // For simplicity, we'll discover player positions during search
      // Start with player adjacent to any box (valid pull positions)
      const boxSet = new Set(goalConfig.map((b) => `${b.x},${b.y}`))

      for (const box of goalConfig) {
        for (const { dx, dy } of DIRECTIONS) {
          const px = box.x + dx
          const py = box.y + dy
          if (isWalkable(px, py, level) && !boxSet.has(`${px},${py}`)) {
            queue.push({
              playerPos: { x: px, y: py },
              boxes: goalConfig.map((b) => ({ ...b })),
              pullCount: 0,
            })
          }
        }
      }
    }
  }

  let statesExplored = 0
  let maxDepthReached = 0
  const BATCH_SIZE = 500

  onProgress?.(0, 0, `Backward search from ${goalConfigs.length} goal configs...`)

  while (queue.length > 0 && statesExplored < maxStates) {
    if (abortSignal?.aborted) {
      return {
        solvable: false,
        solution: null,
        moveCount: 0,
        statesExplored,
        maxDepthReached,
      }
    }

    const batchEnd = Math.min(statesExplored + BATCH_SIZE, maxStates)

    while (queue.length > 0 && statesExplored < batchEnd) {
      const current = queue.shift()!
      statesExplored++
      maxDepthReached = Math.max(maxDepthReached, current.pullCount)

      // Check if we've reached the initial state
      const currentStateKey = encodeColoredBoxState(current.boxes)
      if (currentStateKey === initialStateKey) {
        return {
          solvable: true,
          solution: null,
          moveCount: current.pullCount,
          statesExplored,
          maxDepthReached: current.pullCount,
        }
      }

      // Find all possible pulls (backward moves)
      const possiblePulls = findAllPossiblePulls(current.playerPos, current.boxes, level)

      for (const pull of possiblePulls) {
        const newBoxes = current.boxes.map((b, i) => (i === pull.boxIndex ? pull.newBox : { ...b }))
        const stateKey = encodeColoredBoxState(newBoxes)

        const newPullCount = current.pullCount + 1

        // Only explore if we haven't seen this state or found a shorter path
        const existingCount = transposition.get(stateKey)
        if (existingCount !== undefined && existingCount <= newPullCount) continue

        transposition.set(stateKey, newPullCount)

        queue.push({
          playerPos: pull.newPlayerPos,
          boxes: newBoxes,
          pullCount: newPullCount,
        })
      }
    }

    onProgress?.(
      statesExplored,
      maxDepthReached,
      `Backward search (${transposition.size} unique states)`,
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  // Check if initial state was found in transposition table
  const initialPullCount = transposition.get(initialStateKey)
  if (initialPullCount !== undefined) {
    return {
      solvable: true,
      solution: null,
      moveCount: initialPullCount,
      statesExplored,
      maxDepthReached,
    }
  }

  return {
    solvable: false,
    solution: null,
    moveCount: 0,
    statesExplored,
    maxDepthReached,
  }
}
