import { DIRECTION_VECTORS } from '@src/constants'
import type {
  GameState,
  MoveDirection,
  MoveRecord,
  MoveValidationResult,
  Position,
  SokobanLevel,
} from '@src/types'
import { v4 as uuidv4 } from 'uuid'

/**
 * Initialize a new game state from a level.
 */
export function initializeGame(level: SokobanLevel): GameState {
  return {
    level,
    playerPos: { ...level.playerStart },
    boxes: level.boxStarts.map((b) => ({ ...b })),
    moveHistory: [],
    isWon: false,
    moveCount: 0,
    pushCount: 0,
    startTime: null,
    endTime: null,
  }
}

/**
 * Check if a position is within bounds.
 */
function isInBounds(pos: Position, level: SokobanLevel): boolean {
  return pos.x >= 0 && pos.x < level.width && pos.y >= 0 && pos.y < level.height
}

/**
 * Check if a position is a wall.
 */
function isWall(pos: Position, level: SokobanLevel): boolean {
  return level.terrain[pos.y]?.[pos.x] === 'wall'
}

/**
 * Check if a position has a box.
 */
function hasBox(pos: Position, boxes: Position[]): number {
  return boxes.findIndex((b) => b.x === pos.x && b.y === pos.y)
}

/**
 * Get the new position after moving in a direction.
 */
function getNewPosition(pos: Position, direction: MoveDirection): Position {
  const vector = DIRECTION_VECTORS[direction]
  return {
    x: pos.x + vector.dx,
    y: pos.y + vector.dy,
  }
}

/**
 * Validate if a move is legal.
 * Returns detailed information about the move including if it's a push.
 */
export function validateMove(state: GameState, direction: MoveDirection): MoveValidationResult {
  const { level, playerPos, boxes } = state
  const newPlayerPos = getNewPosition(playerPos, direction)

  // Check if new position is in bounds
  if (!isInBounds(newPlayerPos, level)) {
    return { valid: false, isPush: false, newPlayerPos, error: 'Out of bounds' }
  }

  // Check if new position is a wall
  if (isWall(newPlayerPos, level)) {
    return { valid: false, isPush: false, newPlayerPos, error: 'Wall collision' }
  }

  // Check if there's a box at the new position
  const boxIndex = hasBox(newPlayerPos, boxes)

  if (boxIndex === -1) {
    // No box, simple move
    return { valid: true, isPush: false, newPlayerPos }
  }

  // There's a box - check if we can push it
  const newBoxPos = getNewPosition(newPlayerPos, direction)

  // Check if box destination is in bounds
  if (!isInBounds(newBoxPos, level)) {
    return { valid: false, isPush: true, newPlayerPos, error: 'Cannot push box out of bounds' }
  }

  // Check if box destination is a wall
  if (isWall(newBoxPos, level)) {
    return { valid: false, isPush: true, newPlayerPos, error: 'Cannot push box into wall' }
  }

  // Check if box destination has another box
  if (hasBox(newBoxPos, boxes) !== -1) {
    return { valid: false, isPush: true, newPlayerPos, error: 'Cannot push box into another box' }
  }

  // Valid push
  return {
    valid: true,
    isPush: true,
    newPlayerPos,
    newBoxPos,
    pushedBoxIndex: boxIndex,
  }
}

/**
 * Execute a move and return the new game state.
 * Returns null if the move is invalid.
 */
export function executeMove(
  state: GameState,
  direction: MoveDirection,
  source: 'human' | 'ai' = 'human',
): GameState | null {
  const validation = validateMove(state, direction)

  if (!validation.valid) {
    return null
  }

  const newBoxes = state.boxes.map((b) => ({ ...b }))
  let previousBoxPos: Position | undefined

  // If it's a push, move the box
  if (validation.isPush && validation.pushedBoxIndex !== undefined && validation.newBoxPos) {
    previousBoxPos = { ...newBoxes[validation.pushedBoxIndex] }
    newBoxes[validation.pushedBoxIndex] = validation.newBoxPos
  }

  // Create move record
  const moveRecord: MoveRecord = {
    id: uuidv4(),
    direction,
    wasPush: validation.isPush,
    previousPlayerPos: { ...state.playerPos },
    previousBoxPos,
    source,
    timestamp: Date.now(),
  }

  // Create new state
  const newState: GameState = {
    ...state,
    playerPos: validation.newPlayerPos,
    boxes: newBoxes,
    moveHistory: [...state.moveHistory, moveRecord],
    moveCount: state.moveCount + 1,
    pushCount: state.pushCount + (validation.isPush ? 1 : 0),
    startTime: state.startTime ?? Date.now(),
  }

  // Check win condition
  newState.isWon = checkWin(newState)
  if (newState.isWon && !newState.endTime) {
    newState.endTime = Date.now()
  }

  return newState
}

/**
 * Undo the last move and return the previous game state.
 * Returns the same state if there's nothing to undo.
 */
export function undoMove(state: GameState): GameState {
  if (state.moveHistory.length === 0) {
    return state
  }

  const lastMove = state.moveHistory[state.moveHistory.length - 1]
  const newBoxes = state.boxes.map((b) => ({ ...b }))

  // If last move was a push, restore box position
  if (lastMove.wasPush && lastMove.previousBoxPos) {
    // Find the box at its current position and move it back
    const pushedBoxCurrentPos = getNewPosition(lastMove.previousBoxPos, lastMove.direction)
    const boxIndex = hasBox(pushedBoxCurrentPos, newBoxes)

    if (boxIndex !== -1) {
      newBoxes[boxIndex] = lastMove.previousBoxPos
    }
  }

  return {
    ...state,
    playerPos: lastMove.previousPlayerPos,
    boxes: newBoxes,
    moveHistory: state.moveHistory.slice(0, -1),
    moveCount: state.moveCount - 1,
    pushCount: state.pushCount - (lastMove.wasPush ? 1 : 0),
    isWon: false,
    endTime: null,
  }
}

/**
 * Check if the win condition is met.
 * All boxes must be on goals.
 */
export function checkWin(state: GameState): boolean {
  const { level, boxes } = state
  // Every box must be on a goal
  return boxes.every((box) => level.terrain[box.y]?.[box.x] === 'goal')
}

/**
 * Check if a box is on a goal.
 */
export function isBoxOnGoal(state: GameState, boxIndex: number): boolean {
  const box = state.boxes[boxIndex]
  if (!box) return false
  return state.level.terrain[box.y]?.[box.x] === 'goal'
}

/**
 * Get the number of boxes currently on goals.
 */
export function getBoxesOnGoalsCount(state: GameState): number {
  return state.boxes.filter((_, i) => isBoxOnGoal(state, i)).length
}

/**
 * Check for simple deadlock (box in corner not on goal).
 * This is a basic heuristic and doesn't catch all deadlocks.
 */
export function isSimpleDeadlock(state: GameState): boolean {
  const { level, boxes } = state

  for (const box of boxes) {
    // Skip if box is on goal
    if (level.terrain[box.y]?.[box.x] === 'goal') {
      continue
    }

    // Check if box is in a corner (two adjacent walls)
    const up = { x: box.x, y: box.y - 1 }
    const down = { x: box.x, y: box.y + 1 }
    const left = { x: box.x - 1, y: box.y }
    const right = { x: box.x + 1, y: box.y }

    const wallUp = !isInBounds(up, level) || isWall(up, level)
    const wallDown = !isInBounds(down, level) || isWall(down, level)
    const wallLeft = !isInBounds(left, level) || isWall(left, level)
    const wallRight = !isInBounds(right, level) || isWall(right, level)

    // Corner deadlock: two perpendicular walls
    if (
      (wallUp && wallLeft) ||
      (wallUp && wallRight) ||
      (wallDown && wallLeft) ||
      (wallDown && wallRight)
    ) {
      return true
    }
  }

  return false
}

/**
 * Reset game to initial state while keeping the same level.
 */
export function resetGame(state: GameState): GameState {
  return initializeGame(state.level)
}
