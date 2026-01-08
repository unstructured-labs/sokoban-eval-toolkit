import {
  OPENROUTER_MODELS,
  createOpenRouterClient,
  extractOpenRouterCost,
  extractOpenRouterReasoningTokens,
} from '@sokoban-eval-toolkit/utils'
import { savedLayoutToLevel } from './puzzle-loader'
import { executeSolution, initializeGame, parseAIResponse } from './solution-executor'
import type { Box, BoxColor, EvalResult, GameState, LLMResponse, SavedLayout } from './types'

// Box color display names for prompts
const BOX_COLOR_NAMES: Record<BoxColor, string> = {
  orange: 'Orange',
  purple: 'Purple',
  emerald: 'Emerald',
  sky: 'Sky',
}

// Box color symbols for ASCII representation
const BOX_COLOR_SYMBOLS: Record<BoxColor, string> = {
  orange: 'O',
  purple: 'P',
  emerald: 'E',
  sky: 'S',
}

/**
 * Convert x,y coordinates to r1c4 notation (1-indexed row/column).
 */
function toRowCol(x: number, y: number): string {
  return `r${y + 1}c${x + 1}`
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
 * Generate colored ASCII grid representation.
 */
function generateColoredAsciiGrid(state: GameState): string {
  const { level, playerPos, boxes } = state
  const lines: string[] = []

  for (let y = 0; y < level.height; y++) {
    let line = ''
    for (let x = 0; x < level.width; x++) {
      const terrain = level.terrain[y]?.[x] || 'floor'
      const isPlayer = playerPos.x === x && playerPos.y === y
      const box = boxes.find((b) => b.x === x && b.y === y)
      const isGoal = terrain === 'goal'

      if (terrain === 'wall') {
        line += '#'
      } else if (isPlayer && isGoal) {
        line += '+'
      } else if (isPlayer) {
        line += '@'
      } else if (box && isGoal) {
        line += BOX_COLOR_SYMBOLS[box.color].toLowerCase()
      } else if (box) {
        line += BOX_COLOR_SYMBOLS[box.color]
      } else if (isGoal) {
        line += '.'
      } else {
        line += '-'
      }
    }
    lines.push(`${line}|`)
  }

  return lines.join('\n')
}

/**
 * Generate standard ASCII grid representation.
 */
function generateStandardAsciiGrid(state: GameState): string {
  const { level, playerPos, boxes } = state
  const lines: string[] = []

  for (let y = 0; y < level.height; y++) {
    let line = ''
    for (let x = 0; x < level.width; x++) {
      const terrain = level.terrain[y]?.[x] || 'floor'
      const isPlayer = playerPos.x === x && playerPos.y === y
      const box = boxes.find((b) => b.x === x && b.y === y)
      const isGoal = terrain === 'goal'

      if (terrain === 'wall') {
        line += '#'
      } else if (isPlayer && isGoal) {
        line += '+'
      } else if (isPlayer) {
        line += '@'
      } else if (box && isGoal) {
        line += '*'
      } else if (box) {
        line += '$'
      } else if (isGoal) {
        line += '.'
      } else {
        line += '-'
      }
    }
    lines.push(`${line}|`)
  }

  return lines.join('\n')
}

/**
 * Generate coordinate locations format.
 */
function generateCoordinateLocations(state: GameState): string {
  const parts: string[] = []
  parts.push(`Board: ${state.level.height} rows × ${state.level.width} columns`)
  parts.push(`Player: ${toRowCol(state.playerPos.x, state.playerPos.y)}`)

  // Group boxes by color
  const boxesByColor = new Map<BoxColor, { x: number; y: number }[]>()
  for (const box of state.boxes) {
    const existing = boxesByColor.get(box.color) || []
    existing.push({ x: box.x, y: box.y })
    boxesByColor.set(box.color, existing)
  }

  const boxDescriptions: string[] = []
  for (const [color, boxes] of boxesByColor) {
    const positions = boxes.map((b) => toRowCol(b.x, b.y)).join(', ')
    boxDescriptions.push(`${BOX_COLOR_NAMES[color]} (${BOX_COLOR_SYMBOLS[color]}): ${positions}`)
  }
  parts.push(`Boxes:\n  ${boxDescriptions.join('\n  ')}`)

  // Extract goals from terrain
  const goals: { x: number; y: number }[] = []
  for (let y = 0; y < state.level.height; y++) {
    for (let x = 0; x < state.level.width; x++) {
      if (state.level.terrain[y]?.[x] === 'goal') {
        goals.push({ x, y })
      }
    }
  }
  parts.push(`Goals: ${goals.map((g) => toRowCol(g.x, g.y)).join(', ')}`)

  return parts.join('\n')
}

/**
 * Generate a prompt for an AI to solve a Sokoban puzzle.
 */
function generatePrompt(state: GameState): string {
  const parts: string[] = []
  const isColoredVariant = hasMultipleColors(state.boxes)

  // Header
  if (isColoredVariant) {
    parts.push('# Colored Sokoban Puzzle (Special Variant)')
    parts.push('')
    parts.push('You are solving a COLORED Sokoban variant. Push all boxes onto goals (.) to win.')
    parts.push('')
    parts.push(
      '**CRITICAL CONSTRAINT:** Boxes of the SAME COLOR cannot be directly adjacent (horizontally or vertically). Diagonal adjacency is allowed. Any move that would place same-colored boxes next to each other is INVALID and will fail.',
    )
  } else {
    parts.push('# Sokoban Puzzle')
    parts.push('')
    parts.push('You are solving a Sokoban puzzle. Push all boxes ($) onto goals (.) to win.')
  }
  parts.push('')

  // Rules
  parts.push('## Rules')
  parts.push('- You can move UP, DOWN, LEFT, or RIGHT')
  parts.push('- You can push a box by walking into it (if the space behind it is free)')
  parts.push('- You cannot pull boxes')
  parts.push('- You cannot push more than one box at a time')
  parts.push('- Walls (#) are impassable')
  if (isColoredVariant) {
    parts.push(
      '- **SAME-COLOR ADJACENCY RULE:** You CANNOT push a box to a position where it would be directly adjacent (up/down/left/right) to another box of the same color. This move will be rejected.',
    )
  }
  parts.push('')

  // ASCII Grid
  parts.push('## Current State (ASCII Grid)')
  parts.push('```')
  if (isColoredVariant) {
    parts.push(generateColoredAsciiGrid(state))
  } else {
    parts.push(generateStandardAsciiGrid(state))
  }
  parts.push('```')
  parts.push('')
  parts.push('Legend:')
  parts.push('- # = Wall')
  parts.push('- @ = Player')
  if (isColoredVariant) {
    parts.push('- O = Orange box, o = Orange box on goal')
    parts.push('- P = Purple box, p = Purple box on goal')
    parts.push('- E = Emerald box, e = Emerald box on goal')
    parts.push('- S = Sky box, s = Sky box on goal')
  } else {
    parts.push('- $ = Box')
    parts.push('- * = Box on Goal')
  }
  parts.push('- . = Goal (for boxes)')
  parts.push('- + = Player on Goal')
  parts.push('- - = Floor')
  parts.push('- | = Row boundary (end of each row)')
  parts.push('')

  // Coordinate locations
  parts.push('## Positions')
  parts.push(generateCoordinateLocations(state))
  parts.push('')

  // Progress
  const boxesOnGoals = state.boxes.filter(
    (box) => state.level.terrain[box.y]?.[box.x] === 'goal',
  ).length
  parts.push(`## Progress: ${boxesOnGoals}/${state.boxes.length} boxes on goals`)
  parts.push('')

  // Important note
  parts.push(
    'IMPORTANT: Please do not write any code to solve the puzzle. This is a test of your visual/intuitive reasoning and spatial planning skills.',
  )
  parts.push('')

  // Output format
  parts.push('## Your Task')
  parts.push('Provide a complete solution to move all boxes onto goals.')
  parts.push('')
  parts.push('In your reasoning, explain your solution strategy step-by-step:')
  parts.push('1. Identify which box should be moved to which goal and in what order')
  parts.push('2. Explain why this order avoids deadlocks (boxes stuck in corners or against walls)')
  parts.push(
    '3. Describe the path for each box, noting any boxes that need to be moved out of the way first',
  )
  parts.push('4. Mention any critical moves where the player needs to reposition')
  parts.push('')
  parts.push('Return ONLY a JSON object in this exact format (no other text):')
  parts.push(
    '{"reasoning":"<detailed step-by-step strategy explanation>","solution":["UP","RIGHT","DOWN","LEFT"]}',
  )
  parts.push('')
  parts.push(
    'The "solution" field must be an array of moves. Valid moves: "UP", "DOWN", "LEFT", "RIGHT"',
  )

  return parts.join('\n')
}

/**
 * Call the LLM to get a solution.
 */
async function callLLM(prompt: string, modelId: string): Promise<LLMResponse> {
  const startTime = Date.now()

  try {
    const client = createOpenRouterClient()

    const response = await client.chat.completions.create({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    })

    const durationMs = Date.now() - startTime
    const message = response.choices[0]?.message
    const content = message?.content ?? ''
    const usage = response.usage

    // Extract native reasoning from OpenRouter response
    // biome-ignore lint/suspicious/noExplicitAny: OpenRouter-specific field
    const nativeReasoning = (message as any)?.reasoning as string | undefined

    const parsed = parseAIResponse(content)

    const inputTokens = usage?.prompt_tokens ?? 0
    const outputTokens = usage?.completion_tokens ?? 0
    const reasoningTokens = extractOpenRouterReasoningTokens(usage)
    const cost = extractOpenRouterCost(usage)

    return {
      moves: parsed.moves,
      rawResponse: content,
      nativeReasoning: nativeReasoning || undefined,
      parsedReasoning: parsed.reasoning,
      inputTokens,
      outputTokens,
      reasoningTokens,
      cost,
      durationMs,
      error: parsed.error,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    return {
      moves: [],
      rawResponse: '',
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cost: 0,
      durationMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get model name from model ID.
 */
export function getModelName(modelId: string): string {
  const model = OPENROUTER_MODELS.find((m) => m.id === modelId)
  return model?.name ?? modelId
}

/**
 * Evaluate a single puzzle with a single model (one-shot, no retries).
 */
export async function evaluatePuzzle(puzzle: SavedLayout, modelId: string): Promise<EvalResult> {
  const level = savedLayoutToLevel(puzzle)
  const modelName = getModelName(modelId)

  // Generate prompt for initial state
  const initialState = initializeGame(level)
  const prompt = generatePrompt(initialState)

  // Call LLM
  const llmResponse = await callLLM(prompt, modelId)

  // Check for API error
  if (llmResponse.error && llmResponse.moves.length === 0) {
    const wordsEstimate = Math.round(llmResponse.outputTokens * 0.75)
    const pagesEstimate = Math.round((wordsEstimate / 500) * 100) / 100

    return {
      puzzleId: puzzle.id,
      puzzleName: puzzle.name,
      modelId,
      modelName,
      solved: false,
      error: llmResponse.error,
      inferenceTimeMs: llmResponse.durationMs,
      moves: [],
      solutionLength: 0,
      stepsExecuted: 0,
      inputTokens: llmResponse.inputTokens,
      outputTokens: llmResponse.outputTokens,
      reasoningTokens: llmResponse.reasoningTokens,
      totalTokens: llmResponse.inputTokens + llmResponse.outputTokens,
      cost: llmResponse.cost,
      wordsEstimate,
      pagesEstimate,
      rawResponse: llmResponse.rawResponse,
    }
  }

  // Execute the solution
  const result = executeSolution(level, llmResponse.moves)

  const wordsEstimate = Math.round(llmResponse.outputTokens * 0.75)
  const pagesEstimate = Math.round((wordsEstimate / 500) * 100) / 100

  return {
    puzzleId: puzzle.id,
    puzzleName: puzzle.name,
    modelId,
    modelName,
    solved: result.solved,
    error: result.error,
    inferenceTimeMs: llmResponse.durationMs,
    moves: llmResponse.moves,
    solutionLength: llmResponse.moves.length,
    stepsExecuted: result.stepsExecuted,
    inputTokens: llmResponse.inputTokens,
    outputTokens: llmResponse.outputTokens,
    reasoningTokens: llmResponse.reasoningTokens,
    totalTokens: llmResponse.inputTokens + llmResponse.outputTokens,
    cost: llmResponse.cost,
    wordsEstimate,
    pagesEstimate,
    rawResponse: llmResponse.rawResponse,
  }
}
