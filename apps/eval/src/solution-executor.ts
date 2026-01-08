import { v4 as uuidv4 } from 'uuid'
import type { Box, GameState, MoveDirection, MoveRecord, Position, SokobanLevel } from './types'

// Direction vectors for movement
const DIRECTION_VECTORS: Record<MoveDirection, { dx: number; dy: number }> = {
  UP: { dx: 0, dy: -1 },
  DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 },
  RIGHT: { dx: 1, dy: 0 },
}

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
 * Check if a position has a box. Returns the index of the box, or -1 if not found.
 */
function hasBox(pos: Position, boxes: Box[]): number {
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
 * Check if the puzzle has boxes of multiple colors.
 */
function hasMultipleColors(boxes: Box[]): boolean {
  if (boxes.length <= 1) return false
  const firstColor = boxes[0]?.color
  return boxes.some((b) => b.color !== firstColor)
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

interface MoveValidationResult {
  valid: boolean
  isPush: boolean
  newPlayerPos: Position
  newBox?: Box
  pushedBoxIndex?: number
  error?: string
}

/**
 * Validate if a move is legal.
 */
function validateMove(state: GameState, direction: MoveDirection): MoveValidationResult {
  const { level, playerPos, boxes } = state
  const newPlayerPos = getNewPosition(playerPos, direction)

  if (!isInBounds(newPlayerPos, level)) {
    return { valid: false, isPush: false, newPlayerPos, error: 'Out of bounds' }
  }

  if (isWall(newPlayerPos, level)) {
    return { valid: false, isPush: false, newPlayerPos, error: 'Wall collision' }
  }

  const boxIndex = hasBox(newPlayerPos, boxes)

  if (boxIndex === -1) {
    return { valid: true, isPush: false, newPlayerPos }
  }

  // There's a box - check if we can push it
  const newBoxPos = getNewPosition(newPlayerPos, direction)

  if (!isInBounds(newBoxPos, level)) {
    return { valid: false, isPush: true, newPlayerPos, error: 'Cannot push box out of bounds' }
  }

  if (isWall(newBoxPos, level)) {
    return { valid: false, isPush: true, newPlayerPos, error: 'Cannot push box into wall' }
  }

  if (hasBox(newBoxPos, boxes) !== -1) {
    return { valid: false, isPush: true, newPlayerPos, error: 'Cannot push box into another box' }
  }

  const pushedBox = boxes[boxIndex]
  const newBox: Box = { ...newBoxPos, color: pushedBox.color }

  // Check for same-color adjacency violation
  if (hasMultipleColors(boxes) && hasSameColorAdjacency(newBox, boxes, boxIndex)) {
    return {
      valid: false,
      isPush: true,
      newPlayerPos,
      error: 'Cannot push box adjacent to same-colored box',
    }
  }

  return {
    valid: true,
    isPush: true,
    newPlayerPos,
    newBox,
    pushedBoxIndex: boxIndex,
  }
}

/**
 * Check if the win condition is met.
 */
function checkWin(state: GameState): boolean {
  const { level, boxes } = state
  return boxes.every((box) => level.terrain[box.y]?.[box.x] === 'goal')
}

/**
 * Execute a move and return the new game state.
 * Returns null if the move is invalid.
 */
export function executeMove(state: GameState, direction: MoveDirection): GameState | null {
  const validation = validateMove(state, direction)

  if (!validation.valid) {
    return null
  }

  const newBoxes: Box[] = state.boxes.map((b) => ({ ...b }))
  let previousBox: Box | undefined

  if (validation.isPush && validation.pushedBoxIndex !== undefined && validation.newBox) {
    previousBox = { ...newBoxes[validation.pushedBoxIndex] }
    newBoxes[validation.pushedBoxIndex] = validation.newBox
  }

  const moveRecord: MoveRecord = {
    id: uuidv4(),
    direction,
    wasPush: validation.isPush,
    previousPlayerPos: { ...state.playerPos },
    previousBox,
    source: 'ai',
    timestamp: Date.now(),
  }

  const newState: GameState = {
    ...state,
    playerPos: validation.newPlayerPos,
    boxes: newBoxes,
    moveHistory: [...state.moveHistory, moveRecord],
    moveCount: state.moveCount + 1,
    pushCount: state.pushCount + (validation.isPush ? 1 : 0),
    startTime: state.startTime ?? Date.now(),
  }

  newState.isWon = checkWin(newState)
  if (newState.isWon && !newState.endTime) {
    newState.endTime = Date.now()
  }

  return newState
}

/**
 * Result of executing a solution.
 */
export interface ExecutionResult {
  solved: boolean
  stepsExecuted: number
  invalidMoveIndex: number | null
  error: string | null
  finalState: GameState
}

/**
 * Execute a complete solution and return the result.
 */
export function executeSolution(level: SokobanLevel, moves: MoveDirection[]): ExecutionResult {
  let state = initializeGame(level)
  let stepsExecuted = 0

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i]
    const newState = executeMove(state, move)

    if (!newState) {
      return {
        solved: false,
        stepsExecuted,
        invalidMoveIndex: i,
        error: `Invalid move at step ${i + 1}: ${move}`,
        finalState: state,
      }
    }

    state = newState
    stepsExecuted++

    // Check if we've won
    if (state.isWon) {
      return {
        solved: true,
        stepsExecuted,
        invalidMoveIndex: null,
        error: null,
        finalState: state,
      }
    }
  }

  // Ran out of moves without winning
  return {
    solved: false,
    stepsExecuted,
    invalidMoveIndex: null,
    error: 'Solution did not solve the puzzle',
    finalState: state,
  }
}

/**
 * Parse an AI response and extract moves.
 */
export function parseAIResponse(content: string): {
  moves: MoveDirection[]
  reasoning?: string
  error?: string
} {
  // Try to parse as JSON
  try {
    // Find JSON object in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const json = JSON.parse(jsonMatch[0])

      // Extract moves from various possible fields
      let moves: string[] = []
      if (Array.isArray(json.solution)) {
        moves = json.solution
      } else if (Array.isArray(json.moves)) {
        moves = json.moves
      } else if (json.move) {
        moves = [json.move]
      }

      // Normalize move names
      const normalizedMoves = moves.map(normalizeMove).filter((m): m is MoveDirection => m !== null)

      return {
        moves: normalizedMoves,
        reasoning: json.reasoning,
      }
    }
  } catch {
    // JSON parsing failed
  }

  // Try to extract moves from plain text
  const movePattern = /\b(UP|DOWN|LEFT|RIGHT|U|D|L|R|NORTH|SOUTH|EAST|WEST)\b/gi
  const matches = content.match(movePattern) || []
  const moves = matches.map(normalizeMove).filter((m): m is MoveDirection => m !== null)

  if (moves.length === 0) {
    return {
      moves: [],
      error: 'Could not parse any moves from response',
    }
  }

  return { moves }
}

/**
 * Normalize various move formats to standard direction.
 */
function normalizeMove(move: string): MoveDirection | null {
  const upper = move.toUpperCase()
  switch (upper) {
    case 'UP':
    case 'U':
    case 'NORTH':
      return 'UP'
    case 'DOWN':
    case 'D':
    case 'SOUTH':
      return 'DOWN'
    case 'LEFT':
    case 'L':
    case 'WEST':
      return 'LEFT'
    case 'RIGHT':
    case 'R':
    case 'EAST':
      return 'RIGHT'
    default:
      return null
  }
}
