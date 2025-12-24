import { SOKOBAN_NOTATION } from '@src/constants'
import type { MoveDirection, SokobanLevel, SolutionValidationResult } from '@src/types'
import { executeMove, initializeGame } from './gameEngine'

/**
 * Parse a single move string to MoveDirection.
 */
function parseMove(s: string): MoveDirection | null {
  if (!s) return null
  const normalized = s.toLowerCase().trim()

  // Check Sokoban notation
  if (SOKOBAN_NOTATION[s]) {
    return SOKOBAN_NOTATION[s]
  }

  // Check full names
  switch (normalized) {
    case 'up':
    case 'north':
      return 'UP'
    case 'down':
    case 'south':
      return 'DOWN'
    case 'left':
    case 'west':
      return 'LEFT'
    case 'right':
    case 'east':
      return 'RIGHT'
    default:
      return null
  }
}

/**
 * Parse a solution string in standard Sokoban notation.
 * Supports: u/d/l/r (move), U/D/L/R (push) - we treat both the same.
 * Also supports comma-separated lists and arrays.
 */
export function parseSolution(solution: string): MoveDirection[] {
  const moves: MoveDirection[] = []
  const cleaned = solution.trim()

  // Try parsing as JSON array first
  if (cleaned.startsWith('[')) {
    try {
      const parsed = JSON.parse(cleaned) as string[]
      for (const item of parsed) {
        const move = parseMove(item.toString().trim())
        if (move) moves.push(move)
      }
      return moves
    } catch {
      // Not valid JSON, try other formats
    }
  }

  // Try comma-separated format
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',')
    for (const part of parts) {
      const move = parseMove(part.trim())
      if (move) moves.push(move)
    }
    return moves
  }

  // Parse character by character (Sokoban notation)
  for (const char of cleaned) {
    const move = parseMove(char)
    if (move) moves.push(move)
  }

  return moves
}

/**
 * Validate a solution by executing it step by step.
 * Does not find optimal solutions - just validates if a given sequence works.
 */
export function validateSolution(
  level: SokobanLevel,
  moves: MoveDirection[],
): SolutionValidationResult {
  let state = initializeGame(level)

  for (let i = 0; i < moves.length; i++) {
    const direction = moves[i]
    const newState = executeMove(state, direction, 'ai')

    if (!newState) {
      return {
        valid: false,
        solved: false,
        movesExecuted: i,
        invalidMoveIndex: i,
        finalState: state,
        error: `Invalid move at index ${i}: ${direction}`,
      }
    }

    state = newState

    // Check if solved
    if (state.isWon) {
      return {
        valid: true,
        solved: true,
        movesExecuted: i + 1,
        finalState: state,
      }
    }
  }

  // All moves executed but not solved
  return {
    valid: true,
    solved: false,
    movesExecuted: moves.length,
    finalState: state,
    error: 'Solution did not reach win state',
  }
}

/**
 * Parse AI response to extract moves.
 * Handles various formats AI might return.
 */
export function parseAIResponse(response: string): {
  moves: MoveDirection[]
  rawText: string
  reasoning?: string
  error?: string
} {
  // First, try to parse as our expected JSON format: {"reasoning":"...", "moves":["UP", ...]}
  try {
    // Find JSON object in response (may have surrounding text)
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])

      // Handle full solution format: {"reasoning": "...", "moves": [...]}
      if (Array.isArray(parsed.moves)) {
        const moves = parsed.moves
          .map((m: string) => parseMove(m))
          .filter((m: MoveDirection | null): m is MoveDirection => m !== null)
        if (moves.length > 0) {
          return {
            moves,
            rawText: response,
            reasoning: parsed.reasoning ?? undefined,
          }
        }
      }

      // Handle single move format: {"reasoning": "...", "move": "UP"}
      if (parsed.move) {
        const move = parseMove(parsed.move)
        if (move) {
          return {
            moves: [move],
            rawText: response,
            reasoning: parsed.reasoning ?? undefined,
          }
        }
      }

      // Handle actions array format (like maze toolkit): {"actions": [{"action": "UP"}, ...]}
      if (Array.isArray(parsed.actions)) {
        const moves = parsed.actions
          .map((a: { action: string }) => parseMove(a.action))
          .filter((m: MoveDirection | null): m is MoveDirection => m !== null)
        if (moves.length > 0) {
          return {
            moves,
            rawText: response,
            reasoning: parsed.comments ?? parsed.reasoning ?? undefined,
          }
        }
      }
    }
  } catch {
    // Not valid JSON, try other formats
  }

  // Look for array format: ["UP", "DOWN", ...] or [UP, DOWN, ...]
  const arrayMatch = response.match(/\[([^\]]+)\]/s)
  if (arrayMatch) {
    const inner = arrayMatch[1]
    // Clean up quotes and parse
    const cleaned = inner.replace(/["']/g, '')
    const moves = parseSolution(cleaned)
    if (moves.length > 0) {
      return { moves, rawText: response }
    }
  }

  // Look for Sokoban notation: "Solution: RRDDLLUURR" or similar
  const notationMatch = response.match(/(?:solution|moves?|path)[\s:]*([udlrUDLR]+)/i)
  if (notationMatch) {
    const moves = parseSolution(notationMatch[1])
    if (moves.length > 0) {
      return { moves, rawText: response }
    }
  }

  // Look for comma-separated: "UP, DOWN, LEFT, RIGHT"
  const commaMatch = response.match(/(?:UP|DOWN|LEFT|RIGHT)(?:\s*,\s*(?:UP|DOWN|LEFT|RIGHT))+/gi)
  if (commaMatch) {
    const moves = parseSolution(commaMatch[0])
    if (moves.length > 0) {
      return { moves, rawText: response }
    }
  }

  // Try to parse the whole response as moves
  const moves = parseSolution(response)
  if (moves.length > 0) {
    return { moves, rawText: response }
  }

  return {
    moves: [],
    rawText: response,
    error: 'Could not parse moves from response',
  }
}

/**
 * Convert moves to Sokoban notation string.
 */
export function movesToNotation(moves: MoveDirection[]): string {
  const notationMap: Record<MoveDirection, string> = {
    UP: 'u',
    DOWN: 'd',
    LEFT: 'l',
    RIGHT: 'r',
  }
  return moves.map((m) => notationMap[m]).join('')
}

/**
 * Convert moves to readable format.
 */
export function movesToReadable(moves: MoveDirection[]): string {
  return moves.join(', ')
}
