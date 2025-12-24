import type { GameState, PromptOptions } from '@src/types'
import { gameStateToAscii, gameStateToAsciiWithCoords } from './levelParser'

/**
 * Generate a prompt for an AI to solve a Sokoban puzzle.
 */
export function generateSokobanPrompt(state: GameState, options: PromptOptions): string {
  const parts: string[] = []

  // Header
  parts.push('# Sokoban Puzzle')
  parts.push('')
  parts.push('You are solving a Sokoban puzzle. Push all boxes ($) onto goals (.) to win.')
  parts.push('')

  // Rules
  parts.push('## Rules')
  parts.push('- You can move UP, DOWN, LEFT, or RIGHT')
  parts.push('- You can push a box by walking into it (if the space behind it is free)')
  parts.push('- You cannot pull boxes')
  parts.push('- You cannot push more than one box at a time')
  parts.push('- Walls (#) are impassable')
  parts.push('')

  // Current state representation
  if (options.asciiGrid) {
    parts.push('## Current State (ASCII Grid)')
    parts.push('```')
    parts.push(gameStateToAsciiWithCoords(state))
    parts.push('```')
    parts.push('')
    parts.push('Legend:')
    parts.push('- # = Wall')
    parts.push('- @ = Player')
    parts.push('- $ = Box')
    parts.push('- . = Goal')
    parts.push('- * = Box on Goal')
    parts.push('- + = Player on Goal')
    parts.push('- (space) = Floor')
    parts.push('')
  }

  if (options.coordinateFormat) {
    parts.push('## Positions (x, y where 0,0 is top-left)')
    parts.push(`- Player: (${state.playerPos.x}, ${state.playerPos.y})`)
    parts.push(`- Boxes: ${state.boxes.map((b) => `(${b.x}, ${b.y})`).join(', ')}`)
    parts.push(`- Goals: ${state.level.goals.map((g) => `(${g.x}, ${g.y})`).join(', ')}`)
    parts.push(`- Grid size: ${state.level.width}x${state.level.height}`)
    parts.push('')
  }

  if (options.includeNotationGuide) {
    parts.push('## Notation Guide')
    parts.push('Standard Sokoban notation uses lowercase for moves and uppercase for pushes:')
    parts.push('- u/U = Up')
    parts.push('- d/D = Down')
    parts.push('- l/L = Left')
    parts.push('- r/R = Right')
    parts.push('')
    parts.push('Example solution: "rrddrr" means Right, Right, Down, Down, Right, Right')
    parts.push('')
  }

  // Progress info
  const boxesOnGoals = state.boxes.filter(
    (box) => state.level.terrain[box.y]?.[box.x] === 'goal',
  ).length
  parts.push(`## Progress: ${boxesOnGoals}/${state.boxes.length} boxes on goals`)
  parts.push('')

  // Important note about code
  parts.push(
    'IMPORTANT: Please do not write any code to solve the puzzle. This is a test of your visual/intuitive reasoning and spatial planning skills.',
  )
  parts.push('')

  // Output format
  parts.push('## Your Task')

  if (options.executionMode === 'fullSolution') {
    parts.push('Provide a complete solution to move all boxes onto goals.')
    parts.push('')
    parts.push('Return ONLY a JSON object in this exact format (no other text):')
    parts.push(
      '{"reasoning":"<your step-by-step reasoning here>","moves":["UP","RIGHT","DOWN","LEFT"]}',
    )
    parts.push('')
    parts.push('Valid moves: UP, DOWN, LEFT, RIGHT')
  } else {
    parts.push('Provide the next single move.')
    parts.push('')
    parts.push('Return ONLY a JSON object in this exact format (no other text):')
    parts.push('{"reasoning":"<brief reasoning for this move>","move":"UP"}')
    parts.push('')
    parts.push('Valid moves: UP, DOWN, LEFT, RIGHT')
  }

  return parts.join('\n')
}

/**
 * Generate a minimal prompt (just the grid and basic instructions).
 */
export function generateMinimalPrompt(state: GameState): string {
  const parts: string[] = []

  parts.push('Solve this Sokoban puzzle. Push boxes ($) to goals (.).')
  parts.push('')
  parts.push('```')
  parts.push(gameStateToAscii(state))
  parts.push('```')
  parts.push('')
  parts.push('Reply with moves as a JSON array: ["UP", "DOWN", "LEFT", "RIGHT", ...]')

  return parts.join('\n')
}

/**
 * Generate a move-by-move prompt for iterative solving.
 */
export function generateMoveByMovePrompt(state: GameState, moveHistory: string[]): string {
  const parts: string[] = []

  parts.push('Sokoban puzzle - provide the NEXT SINGLE MOVE.')
  parts.push('')
  parts.push('Current state:')
  parts.push('```')
  parts.push(gameStateToAsciiWithCoords(state))
  parts.push('```')
  parts.push('')

  if (moveHistory.length > 0) {
    parts.push(`Previous moves: ${moveHistory.join(', ')}`)
    parts.push('')
  }

  const boxesOnGoals = state.boxes.filter(
    (box) => state.level.terrain[box.y]?.[box.x] === 'goal',
  ).length
  parts.push(`Progress: ${boxesOnGoals}/${state.boxes.length} boxes on goals`)
  parts.push('')
  parts.push('Reply with ONE move: UP, DOWN, LEFT, or RIGHT')

  return parts.join('\n')
}

/**
 * Default prompt options.
 */
export const DEFAULT_PROMPT_OPTIONS: PromptOptions = {
  asciiGrid: true,
  coordinateFormat: true,
  includeNotationGuide: true,
  executionMode: 'fullSolution',
}
