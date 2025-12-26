import type { GameState, PromptOptions } from '@src/types'
import { gameStateToAscii, gameStateToAsciiWithCoords } from './levelParser'

// Cipher symbol mapping (non-standard symbols to replace standard Sokoban notation)
const CIPHER_MAP = {
  wall: 'W',
  player: 'P',
  box: 'B',
  goal: 'G',
  boxOnGoal: 'X',
  playerOnGoal: 'Y',
  floor: '_',
} as const

/**
 * Extract wall positions from the game state terrain.
 */
function getWallPositions(state: GameState): string {
  const walls: string[] = []
  for (let y = 0; y < state.level.height; y++) {
    for (let x = 0; x < state.level.width; x++) {
      if (state.level.terrain[y]?.[x] === 'wall') {
        walls.push(`(${x},${y})`)
      }
    }
  }
  return walls.join(', ')
}

/**
 * Generate coordinate locations format representation.
 */
function generateCoordinateLocationsFormat(state: GameState): string {
  const parts: string[] = []
  parts.push(`Board Size: ${state.level.width}x${state.level.height}`)
  parts.push(`Wall Locations: ${getWallPositions(state)}`)
  parts.push(`Player Location: (${state.playerPos.x},${state.playerPos.y})`)
  parts.push(`Box Locations: ${state.boxes.map((b) => `(${b.x},${b.y})`).join(', ')}`)
  parts.push(`Goal Locations: ${state.level.goals.map((g) => `(${g.x},${g.y})`).join(', ')}`)
  return parts.join('\n')
}

/**
 * Convert standard Sokoban ASCII to cipher symbols.
 */
function applyCipherSymbols(ascii: string): string {
  return ascii
    .replace(/#/g, CIPHER_MAP.wall)
    .replace(/@/g, CIPHER_MAP.player)
    .replace(/\$/g, CIPHER_MAP.box)
    .replace(/\./g, CIPHER_MAP.goal)
    .replace(/\*/g, CIPHER_MAP.boxOnGoal)
    .replace(/\+/g, CIPHER_MAP.playerOnGoal)
    .replace(/ /g, CIPHER_MAP.floor)
}

/**
 * Generate a prompt for an AI to solve a Sokoban puzzle.
 */
export function generateSokobanPrompt(state: GameState, options: PromptOptions): string {
  const parts: string[] = []

  // Use cipher symbols if enabled
  const useCipher = options.cipherSymbols

  // Symbol definitions based on mode
  const symbols = useCipher
    ? {
        wall: CIPHER_MAP.wall,
        player: CIPHER_MAP.player,
        box: CIPHER_MAP.box,
        goal: CIPHER_MAP.goal,
        boxOnGoal: CIPHER_MAP.boxOnGoal,
        playerOnGoal: CIPHER_MAP.playerOnGoal,
        floor: CIPHER_MAP.floor,
      }
    : {
        wall: '#',
        player: '@',
        box: '$',
        goal: '.',
        boxOnGoal: '*',
        playerOnGoal: '+',
        floor: '(space)',
      }

  // Header
  parts.push('# Sokoban Puzzle')
  parts.push('')
  parts.push(
    `You are solving a Sokoban puzzle. Push all boxes (${symbols.box}) onto goals (${symbols.goal}) to win.`,
  )
  parts.push('')

  // Rules
  parts.push('## Rules')
  parts.push('- You can move UP, DOWN, LEFT, or RIGHT')
  parts.push('- You can push a box by walking into it (if the space behind it is free)')
  parts.push('- You cannot pull boxes')
  parts.push('- You cannot push more than one box at a time')
  parts.push(`- Walls (${symbols.wall}) are impassable`)
  parts.push('')

  // Current state representation
  if (options.asciiGrid) {
    parts.push('## Current State (ASCII Grid)')
    parts.push('```')
    const gridAscii = gameStateToAsciiWithCoords(state)
    parts.push(useCipher ? applyCipherSymbols(gridAscii) : gridAscii)
    parts.push('```')
    parts.push('')
    parts.push('Legend:')
    parts.push(`- ${symbols.wall} = Wall`)
    parts.push(`- ${symbols.player} = Player`)
    parts.push(`- ${symbols.box} = Box`)
    parts.push(`- ${symbols.goal} = Goal`)
    parts.push(`- ${symbols.boxOnGoal} = Box on Goal`)
    parts.push(`- ${symbols.playerOnGoal} = Player on Goal`)
    parts.push(`- ${symbols.floor} = Floor`)
    parts.push('')
  }

  // Coordinate locations format
  if (options.coordinateLocations) {
    parts.push('## Current State (Coordinate Locations)')
    parts.push(generateCoordinateLocationsFormat(state))
    parts.push('')
  }

  // Coordinates are always included
  parts.push('## Positions (x, y where 0,0 is top-left)')
  parts.push(`- Player: (${state.playerPos.x}, ${state.playerPos.y})`)
  parts.push(`- Boxes: ${state.boxes.map((b) => `(${b.x}, ${b.y})`).join(', ')}`)
  parts.push(`- Goals: ${state.level.goals.map((g) => `(${g.x}, ${g.y})`).join(', ')}`)
  parts.push(`- Grid size: ${state.level.width}x${state.level.height}`)
  parts.push('')

  // Notation guide is always included
  parts.push('## Notation Guide')
  parts.push('Standard Sokoban notation uses lowercase for moves and uppercase for pushes:')
  parts.push('- u/U = Up')
  parts.push('- d/D = Down')
  parts.push('- l/L = Left')
  parts.push('- r/R = Right')
  parts.push('')
  parts.push('Example solution: "rrddrr" means Right, Right, Down, Down, Right, Right')
  parts.push('')

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
    parts.push('In your reasoning, explain your solution strategy step-by-step:')
    parts.push('1. Identify which box should be moved to which goal and in what order')
    parts.push(
      '2. Explain why this order avoids deadlocks (boxes stuck in corners or against walls)',
    )
    parts.push(
      '3. Describe the path for each box, noting any boxes that need to be moved out of the way first',
    )
    parts.push('4. Mention any critical moves where the player needs to reposition')
    parts.push('')
    parts.push('Return ONLY a JSON object in this exact format (no other text):')
    parts.push(
      '{"reasoning":"<detailed step-by-step strategy explanation>","moves":["UP","RIGHT","DOWN","LEFT"]}',
    )
    parts.push('')
    parts.push('Valid moves: UP, DOWN, LEFT, RIGHT')
  } else {
    parts.push('Provide the next single move.')
    parts.push('')
    parts.push('In your reasoning, briefly explain:')
    parts.push('- What is the immediate goal of this move?')
    parts.push('- How does it contribute to the overall solution?')
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
  cipherSymbols: false,
  coordinateLocations: false,
}
