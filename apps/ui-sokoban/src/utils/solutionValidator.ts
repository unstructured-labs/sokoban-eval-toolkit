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
 * Parse a solution - expects an array of MoveDirection values.
 * Accepts either a JSON string array or a MoveDirection array directly.
 */
export function parseSolution(solution: string | MoveDirection[]): MoveDirection[] {
  // If already an array, validate and return
  if (Array.isArray(solution)) {
    return solution.filter((item): item is MoveDirection => {
      const move = parseMove(String(item))
      return move !== null
    })
  }

  const moves: MoveDirection[] = []
  const cleaned = solution.trim()

  // Parse as JSON array
  if (cleaned.startsWith('[')) {
    try {
      const parsed = JSON.parse(cleaned) as string[]
      for (const item of parsed) {
        const move = parseMove(item.toString().trim())
        if (move) moves.push(move)
      }
      return moves
    } catch {
      // Not valid JSON
    }
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
 * Expects JSON format with solution array: {"reasoning":"...", "solution":["UP", ...]}
 */
export function parseAIResponse(response: string): {
  moves: MoveDirection[]
  rawText: string
  reasoning?: string
  error?: string
} {
  // Try to parse as our expected JSON format: {"reasoning":"...", "solution":["UP", ...]}
  try {
    // Find JSON object in response (may have surrounding text)
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])

      // Handle solution array format: {"reasoning": "...", "solution": [...]}
      if (Array.isArray(parsed.solution)) {
        const moves = parsed.solution
          .map((m: string) => parseMove(m))
          .filter((m: MoveDirection | null): m is MoveDirection => m !== null)
        return {
          moves,
          rawText: response,
          reasoning: parsed.reasoning ?? undefined,
          error: moves.length === 0 ? 'AI returned empty solution array' : undefined,
        }
      }

      // Handle moves array format (legacy UI format): {"reasoning": "...", "moves": [...]}
      if (Array.isArray(parsed.moves)) {
        const moves = parsed.moves
          .map((m: string) => parseMove(m))
          .filter((m: MoveDirection | null): m is MoveDirection => m !== null)
        return {
          moves,
          rawText: response,
          reasoning: parsed.reasoning ?? undefined,
          error: moves.length === 0 ? 'AI returned empty moves array' : undefined,
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
    }
  } catch {
    // Not valid JSON
  }

  // Look for array format: ["UP", "DOWN", ...]
  const arrayMatch = response.match(/\[([^\]]+)\]/s)
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(`[${arrayMatch[1]}]`)
      const moves = parsed
        .map((m: string) => parseMove(String(m)))
        .filter((m: MoveDirection | null): m is MoveDirection => m !== null)
      if (moves.length > 0) {
        return { moves, rawText: response }
      }
    } catch {
      // Not valid JSON array
    }
  }

  return {
    moves: [],
    rawText: response,
    error: 'Could not parse moves from response. Expected JSON with solution array.',
  }
}

/**
 * Convert moves to Sokoban notation string.
 * @deprecated Used for internal debugging/logging only. New code should use move arrays directly.
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
