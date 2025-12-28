import type { GameState, PromptOptions } from '@src/types'
import { gameStateToAscii } from './levelParser'

// Cipher symbol mapping (non-standard symbols to replace standard Sokoban notation)
const CIPHER_MAP = {
  wall: 'W',
  player: 'P',
  box: 'B',
  goal: 'G',
  boxOnGoal: 'X',
  playerOnGoal: 'Y',
  floor: '_',
  playerGoal: 'T', // Target for player
  playerOnPlayerGoal: 'Z', // Player on their target
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
  if (state.level.playerGoal) {
    parts.push(`Player Goal Location: (${state.level.playerGoal.x},${state.level.playerGoal.y})`)
  }
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
    .replace(/-/g, CIPHER_MAP.floor)
    .replace(/%/g, CIPHER_MAP.playerGoal)
    .replace(/!/g, CIPHER_MAP.playerOnPlayerGoal)
}

/**
 * Generate a prompt for an AI to solve a Sokoban puzzle.
 */
export function generateSokobanPrompt(state: GameState, options: PromptOptions): string {
  const parts: string[] = []

  // Use cipher symbols if enabled
  const useCipher = options.cipherSymbols
  const isVariant = options.variantRules
  const isCustomPushing = options.customPushingRules

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
        playerGoal: CIPHER_MAP.playerGoal,
        playerOnPlayerGoal: CIPHER_MAP.playerOnPlayerGoal,
      }
    : {
        wall: '#',
        player: '@',
        box: '$',
        goal: '.',
        boxOnGoal: '*',
        playerOnGoal: '+',
        floor: '-',
        playerGoal: '%',
        playerOnPlayerGoal: '!',
      }

  // Check if there's a player goal
  const hasPlayerGoal = !!state.level.playerGoal

  // Header - different for variant rules
  if (isVariant) {
    parts.push('# Sokoban Variant Puzzle - Trap Mode')
    parts.push('')
    parts.push(
      'This is a variant Sokoban puzzle with special trap mechanics. The goal is to navigate the player to the Player Goal while avoiding or neutralizing traps.',
    )
    parts.push('')
    parts.push('## Key Differences from Standard Sokoban:')
    parts.push(`- **Traps**: What normally appear as goals (${symbols.goal}) are now deadly traps`)
    parts.push('- **Player cannot walk on traps**: Moving onto a trap causes immediate loss')
    parts.push(
      `- **Neutralize traps**: Push a box (${symbols.box}) onto a trap to neutralize it - both the box and trap disappear, leaving a safe floor that the player can NOW walk over`,
    )
    parts.push(
      `- **Win condition**: Reach the Player Goal (${symbols.playerGoal}) - boxes do NOT need to be on any locations`,
    )
    parts.push('')
    parts.push('### Example: Neutralizing a Trap')
    parts.push(
      `Before (player pushes box LEFT onto trap): ${symbols.wall}-${symbols.goal}${symbols.box}${symbols.player}-${symbols.wall}`,
    )
    parts.push(
      `After (box and trap both disappear):       ${symbols.wall}--${symbols.player}--${symbols.wall}`,
    )
    parts.push('')
  } else {
    parts.push('# Sokoban Puzzle')
    parts.push('')
    if (hasPlayerGoal) {
      parts.push(
        'This is a Sokoban-like game with a modification. In addition to the normal rules, the final goal is to move the player onto the Player Goal location, which is a specific location on the board.',
      )
      parts.push('')
      // Check if there are more boxes than goals
      const numBoxes = state.boxes.length
      const numGoals = state.level.goals.length
      if (numBoxes > numGoals) {
        parts.push(
          `Note: There are more boxes (${numBoxes}) than box goals (${numGoals}). You must cover all available box goals with boxes, leaving ${numBoxes - numGoals} box(es) not on goals. Then move the player to the Player Goal.`,
        )
        parts.push('')
      }
      parts.push(
        `Cover all box goals (${symbols.goal}) with boxes (${symbols.box}), AND move the player (${symbols.player}) to the Player Goal (${symbols.playerGoal}) to win.`,
      )
    } else {
      parts.push(
        `You are solving a Sokoban puzzle. Push all boxes (${symbols.box}) onto goals (${symbols.goal}) to win.`,
      )
    }
    parts.push('')
  }

  // Rules
  parts.push('## Rules')
  parts.push('- You can move UP, DOWN, LEFT, or RIGHT')
  parts.push('- You can push a box by walking into it (if the space behind it is free)')
  parts.push('- You cannot pull boxes')

  // Custom pushing rules explanation
  if (isCustomPushing) {
    parts.push(
      '- **Custom Pushing**: You CAN push multiple boxes at once if they are aligned in a row',
    )
    parts.push(
      '  - When boxes are consecutive in the push direction, pushing the first box pushes ALL of them',
    )
    parts.push('  - The last box in the chain must have an empty space to move into')
    parts.push('  - Example: Player pushes RIGHT into [Box][Box][Empty] → [Empty][Box][Box]')
    parts.push('  - You still cannot push boxes through walls')
  } else {
    parts.push('- You cannot push more than one box at a time')
  }

  parts.push(`- Walls (${symbols.wall}) are impassable`)

  if (isVariant) {
    parts.push(
      `- **DANGER**: Traps (${symbols.goal}) are deadly - the player CANNOT move onto them`,
    )
    parts.push(
      '- Push a box onto a trap to neutralize it (both box and trap disappear, leaving a safe floor that the player can NOW walk over)',
    )
    parts.push(
      `- The puzzle is solved when the player reaches the Player Goal (${symbols.playerGoal})`,
    )
  } else if (hasPlayerGoal) {
    const numBoxes = state.boxes.length
    const numGoals = state.level.goals.length
    if (numBoxes > numGoals) {
      parts.push(
        `- The puzzle is solved when all ${numGoals} box goals are covered by boxes AND the player is on the Player Goal (${symbols.playerGoal})`,
      )
    } else {
      parts.push(
        `- The puzzle is solved when all boxes are on goals AND the player is on the Player Goal (${symbols.playerGoal})`,
      )
    }
  }
  parts.push('')

  // Current state representation
  if (options.asciiGrid) {
    parts.push('## Current State (ASCII Grid)')
    parts.push('```')
    const gridAscii = gameStateToAscii(state)
    parts.push(useCipher ? applyCipherSymbols(gridAscii) : gridAscii)
    parts.push('```')
    parts.push('')
    parts.push('Legend:')
    parts.push(`- ${symbols.wall} = Wall`)
    parts.push(`- ${symbols.player} = Player`)
    parts.push(`- ${symbols.box} = Box`)
    if (isVariant) {
      parts.push(`- ${symbols.goal} = Trap (DEADLY - do not step on!)`)
      parts.push(`- ${symbols.boxOnGoal} = Box on Trap (will neutralize if pushed)`)
    } else {
      parts.push(`- ${symbols.goal} = Goal (for boxes)`)
      parts.push(`- ${symbols.boxOnGoal} = Box on Goal`)
      parts.push(`- ${symbols.playerOnGoal} = Player on Goal`)
    }
    parts.push(`- ${symbols.floor} = Floor`)
    if (hasPlayerGoal) {
      parts.push(`- ${symbols.playerGoal} = Player Goal (destination for player)`)
      parts.push(`- ${symbols.playerOnPlayerGoal} = Player on Player Goal (win condition)`)
    }
    parts.push('- | = Row boundary (end of each row)')
    parts.push('')
  }

  // Coordinate locations format (optional, for detailed position info)
  if (options.coordinateLocations) {
    parts.push('## Positions')
    parts.push(generateCoordinateLocationsFormat(state))
    parts.push('')
  }

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
  if (isVariant) {
    // Count traps (goals not yet neutralized)
    const totalTraps = state.level.goals.length
    const neutralizedTraps = state.neutralizedTraps.length
    const remainingTraps = totalTraps - neutralizedTraps
    parts.push('## Progress')
    parts.push(`- Traps remaining: ${remainingTraps}/${totalTraps}`)
    parts.push(`- Boxes remaining: ${state.boxes.length}`)
    parts.push(
      `- Player position: (${state.playerPos.x},${state.playerPos.y}) | Target: (${state.level.playerGoal?.x ?? '?'},${state.level.playerGoal?.y ?? '?'})`,
    )
  } else {
    const boxesOnGoals = state.boxes.filter(
      (box) => state.level.terrain[box.y]?.[box.x] === 'goal',
    ).length
    parts.push(`## Progress: ${boxesOnGoals}/${state.boxes.length} boxes on goals`)
  }
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
  const hasPlayerGoal = !!state.level.playerGoal

  if (hasPlayerGoal) {
    const numBoxes = state.boxes.length
    const numGoals = state.level.goals.length
    if (numBoxes > numGoals) {
      parts.push(
        `Solve this Sokoban puzzle. Cover all ${numGoals} box goals (.) with boxes ($), then move the player (@) to the Player Goal (%). Note: ${numBoxes} boxes but only ${numGoals} goals.`,
      )
    } else {
      parts.push(
        'Solve this Sokoban puzzle. Push boxes ($) to goals (.) AND move the player (@) to the Player Goal (%).',
      )
    }
  } else {
    parts.push('Solve this Sokoban puzzle. Push boxes ($) to goals (.).')
  }
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
  const hasPlayerGoal = !!state.level.playerGoal

  if (hasPlayerGoal) {
    const numBoxes = state.boxes.length
    const numGoals = state.level.goals.length
    if (numBoxes > numGoals) {
      parts.push(
        `Sokoban puzzle (with Player Goal) - provide the NEXT SINGLE MOVE. Cover all ${numGoals} goals with boxes, then player must reach %.`,
      )
    } else {
      parts.push(
        'Sokoban puzzle (with Player Goal) - provide the NEXT SINGLE MOVE. Player must reach % after all boxes are on goals.',
      )
    }
  } else {
    parts.push('Sokoban puzzle - provide the NEXT SINGLE MOVE.')
  }
  parts.push('')
  parts.push('Current state:')
  parts.push('```')
  parts.push(gameStateToAscii(state))
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
  if (hasPlayerGoal) {
    const playerOnGoal =
      state.playerPos.x === state.level.playerGoal?.x &&
      state.playerPos.y === state.level.playerGoal?.y
    parts.push(`Player on Player Goal: ${playerOnGoal ? 'Yes' : 'No'}`)
  }
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
  variantRules: false,
  customPushingRules: false,
}
