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
    isLost: false,
    neutralizedTraps: [],
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
 * Check if a position is a trap (goal that hasn't been neutralized).
 * Only applies in variant mode.
 */
function isTrap(pos: Position, level: SokobanLevel, neutralizedTraps: Position[]): boolean {
  // Goals are traps in variant mode
  if (level.terrain[pos.y]?.[pos.x] !== 'goal') {
    return false
  }
  // Check if this trap has been neutralized
  return !neutralizedTraps.some((t) => t.x === pos.x && t.y === pos.y)
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
 * @param variantRules - If true, goals become traps that kill the player
 * @param customPushingRules - If true, allows pushing multiple boxes in a row
 */
export function validateMove(
  state: GameState,
  direction: MoveDirection,
  variantRules = false,
  customPushingRules = false,
): MoveValidationResult {
  const { level, playerPos, boxes, neutralizedTraps } = state
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
    // No box, simple move - but check for trap in variant mode
    if (variantRules && isTrap(newPlayerPos, level, neutralizedTraps)) {
      // Player is trying to move onto a trap - this is valid but will cause loss
      return { valid: true, isPush: false, newPlayerPos, error: 'Player stepped on trap' }
    }
    return { valid: true, isPush: false, newPlayerPos }
  }

  // There's a box - check if we can push it (possibly with more boxes in a row)
  if (customPushingRules) {
    // Custom pushing: find all boxes in a row and check if they can all move
    const boxChain: number[] = [boxIndex]
    const boxPositions: Position[] = [boxes[boxIndex]]
    let checkPos = getNewPosition(newPlayerPos, direction)

    // Find all consecutive boxes in the push direction
    while (true) {
      const nextBoxIndex = hasBox(checkPos, boxes)
      if (nextBoxIndex === -1) {
        break // No more boxes in the chain
      }
      boxChain.push(nextBoxIndex)
      boxPositions.push(boxes[nextBoxIndex])
      checkPos = getNewPosition(checkPos, direction)
    }

    // checkPos is now the position where the last box would move to
    const finalDestination = checkPos

    // Check if final destination is in bounds
    if (!isInBounds(finalDestination, level)) {
      return {
        valid: false,
        isPush: true,
        newPlayerPos,
        error: 'Cannot push boxes out of bounds',
      }
    }

    // Check if final destination is a wall
    if (isWall(finalDestination, level)) {
      return { valid: false, isPush: true, newPlayerPos, error: 'Cannot push boxes into wall' }
    }

    // Calculate new positions for all boxes (each moves one step in the direction)
    const newBoxPositions: Position[] = boxPositions.map((pos) => getNewPosition(pos, direction))

    // Check if pushing box onto a trap (only applies to last box in variant mode)
    const neutralizesTrap =
      variantRules && isTrap(newBoxPositions[newBoxPositions.length - 1], level, neutralizedTraps)

    // Valid multi-box push
    return {
      valid: true,
      isPush: true,
      newPlayerPos,
      newBoxPos: newBoxPositions[0], // First box's new position (for backwards compatibility)
      pushedBoxIndex: boxIndex, // First box index (for backwards compatibility)
      pushedBoxIndices: boxChain,
      newBoxPositions,
      neutralizesTrap,
    }
  }

  // Standard pushing: only one box allowed
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

  // Check if pushing box onto a trap (neutralizes it in variant mode)
  const neutralizesTrap = variantRules && isTrap(newBoxPos, level, neutralizedTraps)

  // Valid push
  return {
    valid: true,
    isPush: true,
    newPlayerPos,
    newBoxPos,
    pushedBoxIndex: boxIndex,
    neutralizesTrap,
  }
}

/**
 * Execute a move and return the new game state.
 * Returns null if the move is invalid.
 * @param variantRules - If true, goals become traps
 * @param customPushingRules - If true, allows pushing multiple boxes in a row
 */
export function executeMove(
  state: GameState,
  direction: MoveDirection,
  source: 'human' | 'ai' = 'human',
  variantRules = false,
  customPushingRules = false,
): GameState | null {
  const validation = validateMove(state, direction, variantRules, customPushingRules)

  if (!validation.valid) {
    return null
  }

  let newBoxes = state.boxes.map((b) => ({ ...b }))
  let previousBoxPos: Position | undefined
  let previousBoxPositions: Position[] | undefined
  let neutralizedTrap: Position | undefined
  let newNeutralizedTraps = [...state.neutralizedTraps]

  // If it's a push, handle the box(es)
  if (validation.isPush) {
    // Check if this is a multi-box push (custom pushing rules)
    if (
      validation.pushedBoxIndices &&
      validation.newBoxPositions &&
      validation.pushedBoxIndices.length > 1
    ) {
      // Multi-box push: store all previous positions for undo
      previousBoxPositions = validation.pushedBoxIndices.map((idx) => ({ ...newBoxes[idx] }))

      // Move all boxes to their new positions
      for (let i = 0; i < validation.pushedBoxIndices.length; i++) {
        const boxIdx = validation.pushedBoxIndices[i]
        const newPos = validation.newBoxPositions[i]
        newBoxes[boxIdx] = newPos
      }

      // Check if pushing onto a trap (in variant mode) - only last box can neutralize
      if (validation.neutralizesTrap) {
        const lastBoxIdx = validation.pushedBoxIndices[validation.pushedBoxIndices.length - 1]
        neutralizedTrap = validation.newBoxPositions[validation.newBoxPositions.length - 1]
        newNeutralizedTraps = [...newNeutralizedTraps, neutralizedTrap]
        newBoxes = newBoxes.filter((_, i) => i !== lastBoxIdx)
      }
    } else if (validation.pushedBoxIndex !== undefined && validation.newBoxPos) {
      // Single box push (standard or custom with just one box)
      previousBoxPos = { ...newBoxes[validation.pushedBoxIndex] }

      // Check if pushing onto a trap (in variant mode)
      if (validation.neutralizesTrap) {
        // Box and trap both disappear - remove the box
        neutralizedTrap = validation.newBoxPos
        newNeutralizedTraps = [...newNeutralizedTraps, validation.newBoxPos]
        newBoxes = newBoxes.filter((_, i) => i !== validation.pushedBoxIndex)
      } else {
        // Normal push - move the box
        newBoxes[validation.pushedBoxIndex] = validation.newBoxPos
      }
    }
  }

  // Create move record
  const moveRecord: MoveRecord = {
    id: uuidv4(),
    direction,
    wasPush: validation.isPush,
    previousPlayerPos: { ...state.playerPos },
    previousBoxPos,
    previousBoxPositions,
    neutralizedTrap,
    source,
    timestamp: Date.now(),
  }

  // Create new state
  const newState: GameState = {
    ...state,
    playerPos: validation.newPlayerPos,
    boxes: newBoxes,
    neutralizedTraps: newNeutralizedTraps,
    moveHistory: [...state.moveHistory, moveRecord],
    moveCount: state.moveCount + 1,
    pushCount: state.pushCount + (validation.isPush ? 1 : 0),
    startTime: state.startTime ?? Date.now(),
  }

  // Check for loss in variant mode (player stepped on trap)
  if (variantRules && validation.error === 'Player stepped on trap') {
    newState.isLost = true
    newState.endTime = Date.now()
    return newState
  }

  // Check win condition
  newState.isWon = checkWin(newState, variantRules)
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
  let newBoxes = state.boxes.map((b) => ({ ...b }))
  let newNeutralizedTraps = [...state.neutralizedTraps]

  // If last move was a push, restore box position(s)
  if (lastMove.wasPush) {
    // Check for multi-box push (custom pushing rules)
    if (lastMove.previousBoxPositions && lastMove.previousBoxPositions.length > 0) {
      // Multi-box push undo
      if (lastMove.neutralizedTrap) {
        // Last box was pushed onto a trap and disappeared - restore it
        const lastPrevPos = lastMove.previousBoxPositions[lastMove.previousBoxPositions.length - 1]
        newBoxes = [...newBoxes, lastPrevPos]
        // Remove the trap from neutralized list
        const trapPos = lastMove.neutralizedTrap
        newNeutralizedTraps = newNeutralizedTraps.filter(
          (t) => t.x !== trapPos.x || t.y !== trapPos.y,
        )
        // Restore other boxes (all except last which was re-added above)
        for (let i = 0; i < lastMove.previousBoxPositions.length - 1; i++) {
          const prevPos = lastMove.previousBoxPositions[i]
          const currentPos = getNewPosition(prevPos, lastMove.direction)
          const boxIndex = hasBox(currentPos, newBoxes)
          if (boxIndex !== -1) {
            newBoxes[boxIndex] = prevPos
          }
        }
      } else {
        // Normal multi-box push - restore all boxes to their previous positions
        for (const prevPos of lastMove.previousBoxPositions) {
          const currentPos = getNewPosition(prevPos, lastMove.direction)
          const boxIndex = hasBox(currentPos, newBoxes)
          if (boxIndex !== -1) {
            newBoxes[boxIndex] = prevPos
          }
        }
      }
    } else if (lastMove.previousBoxPos) {
      // Single box push undo
      if (lastMove.neutralizedTrap) {
        // Box was pushed onto a trap and disappeared - restore the box at its previous position
        newBoxes = [...newBoxes, lastMove.previousBoxPos]
        // Remove the trap from neutralized list
        const trapPos = lastMove.neutralizedTrap
        newNeutralizedTraps = newNeutralizedTraps.filter(
          (t) => t.x !== trapPos.x || t.y !== trapPos.y,
        )
      } else {
        // Normal push - box was at previousBoxPos, then pushed one step in direction
        // So box is now at previousBoxPos + direction
        const pushedBoxCurrentPos = getNewPosition(lastMove.previousBoxPos, lastMove.direction)
        const boxIndex = hasBox(pushedBoxCurrentPos, newBoxes)

        if (boxIndex !== -1) {
          newBoxes[boxIndex] = lastMove.previousBoxPos
        }
      }
    }
  }

  return {
    ...state,
    playerPos: lastMove.previousPlayerPos,
    boxes: newBoxes,
    neutralizedTraps: newNeutralizedTraps,
    moveHistory: state.moveHistory.slice(0, -1),
    moveCount: state.moveCount - 1,
    pushCount: state.pushCount - (lastMove.wasPush ? 1 : 0),
    isWon: false,
    isLost: false,
    endTime: null,
  }
}

/**
 * Check if the win condition is met.
 * In standard mode: all boxes must be on goals.
 * In variant mode: player must be on player goal (all traps should be neutralized to get there).
 */
export function checkWin(state: GameState, variantRules = false): boolean {
  const { level, playerPos, boxes } = state

  if (variantRules) {
    // Variant mode: player must reach the player goal
    if (!level.playerGoal) {
      return false // No player goal set, can't win in variant mode
    }
    return playerPos.x === level.playerGoal.x && playerPos.y === level.playerGoal.y
  }

  // Standard mode: every box must be on a goal
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
