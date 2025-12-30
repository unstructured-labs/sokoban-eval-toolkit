#!/usr/bin/env bun

/**
 * Solution Generation CLI
 *
 * Generates reasoning solutions for Sokoban puzzles using LLMs via OpenRouter.
 * Reads test puzzles from JSONL, runs them through the selected model,
 * and outputs training data with full reasoning traces.
 *
 * Features:
 * - Validates LLM solutions by replaying moves
 * - Retries up to 3 times on invalid solutions
 * - Optional fallback model if primary model fails
 * - Marks unsolved puzzles in output
 *
 * Usage:
 *   bun scripts/generate-solutions.ts
 */

import * as fs from 'node:fs'
import { ExitPromptError } from '@inquirer/core'
import { confirm, input, select } from '@inquirer/prompts'
import {
  OPENROUTER_MODELS,
  createOpenRouterClient,
  extractOpenRouterCost,
  extractOpenRouterReasoningTokens,
  hasOpenRouterApiKey,
} from '@sokoban-eval-toolkit/utils'
import pLimit from 'p-limit'

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_RETRIES = 3

// ============================================================================
// Types
// ============================================================================

interface TestEntry {
  puzzle_id: string
  type: 'sokoban'
  difficulty: string
  puzzle: string[]
  messages: Array<{ role: string; content: string }>
}

interface TrainEntry {
  puzzle_id: string
  type: 'sokoban'
  difficulty: string
  puzzle: string[]
  messages: Array<{ role: string; content: string }>
  unsolved?: boolean
}

interface GenerationConfig {
  model: string
  fallbackModel: string | null
  inputFile: string
  outputFile: string
  concurrency: number
  count: number
  startIndex: number
  maxRetries: number
  verbose: boolean
}

interface GenerationStats {
  total: number
  completed: number
  solvedByPrimary: number
  solvedByFallback: number
  failed: number
  unsolved: number
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
  totalReasoningTokens: number
}

interface ProcessResult {
  index: number
  entry: TestEntry
  trainEntry?: TrainEntry
  error?: string
  cost: number
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  durationMs: number
  attempts: number
  usedFallback: boolean
}

interface LLMResult {
  response: string
  reasoning?: string
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  cost: number
  durationMs: number
  error?: string
}

type MoveDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

interface Position {
  x: number
  y: number
}

interface PuzzleState {
  width: number
  height: number
  walls: Set<string>
  player: Position
  boxes: Position[]
  goals: Position[]
}

// ============================================================================
// Utilities
// ============================================================================

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`
  }
  return `$${cost.toFixed(2)}`
}

function posKey(x: number, y: number): string {
  return `${x},${y}`
}

// ============================================================================
// Puzzle Parsing & Validation
// ============================================================================

/**
 * Parse a puzzle from its ASCII representation.
 */
function parsePuzzle(puzzle: string[]): PuzzleState {
  const walls = new Set<string>()
  let player: Position = { x: 0, y: 0 }
  const boxes: Position[] = []
  const goals: Position[] = []

  for (let y = 0; y < puzzle.length; y++) {
    const row = puzzle[y]
    for (let x = 0; x < row.length; x++) {
      const char = row[x]
      switch (char) {
        case '#':
          walls.add(posKey(x, y))
          break
        case '@':
          player = { x, y }
          break
        case '+': // Player on goal
          player = { x, y }
          goals.push({ x, y })
          break
        case '$':
          boxes.push({ x, y })
          break
        case '*': // Box on goal
          boxes.push({ x, y })
          goals.push({ x, y })
          break
        case '.':
          goals.push({ x, y })
          break
      }
    }
  }

  return {
    width: puzzle[0]?.length ?? 0,
    height: puzzle.length,
    walls,
    player,
    boxes,
    goals,
  }
}

/**
 * Parse moves from LLM response. Finds contiguous U/D/L/R sequences.
 */
function parseMoves(response: string): MoveDirection[] {
  const moves: MoveDirection[] = []

  // Find all contiguous sequences of U/D/L/R (case insensitive)
  // This avoids picking up letters from words like "UP", "DOWN", "LEFT", "RIGHT" in reasoning
  const sequences = response.match(/[UDLRudlr]{3,}/g) || []

  // Use the longest sequence found (most likely to be the actual solution)
  let bestSequence = ''
  for (const seq of sequences) {
    if (seq.length > bestSequence.length) {
      bestSequence = seq
    }
  }

  const normalized = bestSequence.toUpperCase()

  for (const char of normalized) {
    switch (char) {
      case 'U':
        moves.push('UP')
        break
      case 'D':
        moves.push('DOWN')
        break
      case 'L':
        moves.push('LEFT')
        break
      case 'R':
        moves.push('RIGHT')
        break
    }
  }

  return moves
}

/**
 * Validate a solution by replaying the moves.
 * Returns true if the solution results in all boxes on goals.
 */
function validateSolution(puzzle: string[], moves: MoveDirection[]): boolean {
  if (moves.length === 0) return false

  const state = parsePuzzle(puzzle)
  let player = { ...state.player }
  const boxes = state.boxes.map((b) => ({ ...b }))

  const directions: Record<MoveDirection, { dx: number; dy: number }> = {
    UP: { dx: 0, dy: -1 },
    DOWN: { dx: 0, dy: 1 },
    LEFT: { dx: -1, dy: 0 },
    RIGHT: { dx: 1, dy: 0 },
  }

  for (const move of moves) {
    const { dx, dy } = directions[move]
    const newX = player.x + dx
    const newY = player.y + dy

    // Check wall
    if (state.walls.has(posKey(newX, newY))) {
      return false
    }

    // Check box
    const boxIndex = boxes.findIndex((b) => b.x === newX && b.y === newY)
    if (boxIndex !== -1) {
      const newBoxX = newX + dx
      const newBoxY = newY + dy

      // Box blocked by wall or another box
      if (state.walls.has(posKey(newBoxX, newBoxY))) {
        return false
      }
      if (boxes.some((b) => b.x === newBoxX && b.y === newBoxY)) {
        return false
      }

      // Push the box
      boxes[boxIndex] = { x: newBoxX, y: newBoxY }
    }

    // Move player
    player = { x: newX, y: newY }
  }

  // Check if all boxes are on goals
  const goalSet = new Set(state.goals.map((g) => posKey(g.x, g.y)))
  return boxes.every((b) => goalSet.has(posKey(b.x, b.y)))
}

// ============================================================================
// File I/O
// ============================================================================

async function readJsonlFile(filePath: string): Promise<TestEntry[]> {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.trim().split('\n')
  return lines.map((line) => JSON.parse(line) as TestEntry)
}

function appendJsonlEntry(filePath: string, entry: TrainEntry): void {
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`)
}

// ============================================================================
// LLM Integration
// ============================================================================

async function generateSolution(
  client: ReturnType<typeof createOpenRouterClient>,
  entry: TestEntry,
  model: string,
): Promise<LLMResult> {
  const startTime = Date.now()

  try {
    // Flatten system message into user message for better model compatibility
    const systemMsg = entry.messages.find((m) => m.role === 'system')
    const userMsg = entry.messages.find((m) => m.role === 'user')

    const combinedContent = systemMsg
      ? `${systemMsg.content}\n\n${userMsg?.content || ''}`
      : userMsg?.content || ''

    const messages = [{ role: 'user' as const, content: combinedContent }]

    // Some models/providers don't support temperature, so we omit it for safety
    const response = await client.chat.completions.create({
      model,
      messages,
    })

    const durationMs = Date.now() - startTime
    const message = response.choices[0]?.message
    const content = message?.content ?? ''
    const usage = response.usage

    // biome-ignore lint/suspicious/noExplicitAny: OpenRouter-specific field
    const nativeReasoning = (message as any)?.reasoning as string | undefined

    const inputTokens = usage?.prompt_tokens ?? 0
    const outputTokens = usage?.completion_tokens ?? 0
    const reasoningTokens = extractOpenRouterReasoningTokens(usage)
    const cost = extractOpenRouterCost(usage)

    return {
      response: content,
      reasoning: nativeReasoning,
      inputTokens,
      outputTokens,
      reasoningTokens,
      cost,
      durationMs,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    let errorMessage = 'Unknown error'
    if (error instanceof Error) {
      errorMessage = error.message
      // Try to extract more details from OpenAI-style errors
      // biome-ignore lint/suspicious/noExplicitAny: Error may have extra fields
      const anyError = error as any
      if (anyError.status) {
        errorMessage = `${anyError.status}: ${error.message}`
      }
      if (anyError.error?.message) {
        errorMessage = `${anyError.status || 'Error'}: ${anyError.error.message}`
      }
      // Log full error for debugging
      if (process.env.DEBUG) {
        console.error('Full error:', JSON.stringify(anyError, null, 2))
      }
    }
    return {
      response: '',
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cost: 0,
      durationMs,
      error: errorMessage,
    }
  }
}

// ============================================================================
// Processing with Validation & Retry
// ============================================================================

async function processOneEntry(
  client: ReturnType<typeof createOpenRouterClient>,
  entry: TestEntry,
  index: number,
  model: string,
  fallbackModel: string | null,
  maxRetries: number,
  verbose: boolean,
): Promise<ProcessResult> {
  let totalCost = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalReasoningTokens = 0
  let totalDurationMs = 0
  let attempts = 0
  let usedFallback = false
  let lastResult: LLMResult | null = null
  let lastResponse = ''
  let lastReasoning: string | undefined

  const log = (msg: string) => {
    if (verbose) {
      console.log(`  [${entry.puzzle_id}] ${msg}`)
    }
  }

  // Try primary model up to maxRetries times
  for (let i = 0; i < maxRetries; i++) {
    attempts++
    log(`Attempt ${attempts}/${maxRetries} with primary model (${model})...`)
    const result = await generateSolution(client, entry, model)

    totalCost += result.cost
    totalInputTokens += result.inputTokens
    totalOutputTokens += result.outputTokens
    totalReasoningTokens += result.reasoningTokens
    totalDurationMs += result.durationMs
    lastResult = result
    lastResponse = result.response
    lastReasoning = result.reasoning

    if (result.error) {
      log(`API error: ${result.error}`)
      // Wait before retry to avoid rate limits
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000))
      }
      continue
    }

    // Parse and validate the solution
    const moves = parseMoves(result.response)
    log(
      `Parsed ${moves.length} moves from response (${moves
        .slice(0, 10)
        .map((m) => m[0])
        .join('')}${moves.length > 10 ? '...' : ''})`,
    )

    if (validateSolution(entry.puzzle, moves)) {
      log('Valid solution found!')
      // Valid solution found
      const trainEntry: TrainEntry = {
        puzzle_id: entry.puzzle_id,
        type: 'sokoban',
        difficulty: entry.difficulty,
        puzzle: entry.puzzle,
        messages: [
          ...entry.messages,
          {
            role: 'assistant',
            content: result.reasoning
              ? `<think>\n${result.reasoning}\n</think>\n\n${result.response}`
              : result.response,
          },
        ],
      }

      return {
        index,
        entry,
        trainEntry,
        cost: totalCost,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        reasoningTokens: totalReasoningTokens,
        durationMs: totalDurationMs,
        attempts,
        usedFallback: false,
      }
    }
    log('Validation failed - solution does not solve puzzle')
  }

  // Try fallback model if available
  if (fallbackModel) {
    usedFallback = true
    attempts++
    log(`Trying fallback model (${fallbackModel})...`)
    const result = await generateSolution(client, entry, fallbackModel)

    totalCost += result.cost
    totalInputTokens += result.inputTokens
    totalOutputTokens += result.outputTokens
    totalReasoningTokens += result.reasoningTokens
    totalDurationMs += result.durationMs
    lastResult = result
    lastResponse = result.response
    lastReasoning = result.reasoning

    if (result.error) {
      log(`Fallback API error: ${result.error}`)
    } else {
      const moves = parseMoves(result.response)
      log(`Fallback parsed ${moves.length} moves`)

      if (validateSolution(entry.puzzle, moves)) {
        log('Fallback solution valid!')
        const trainEntry: TrainEntry = {
          puzzle_id: entry.puzzle_id,
          type: 'sokoban',
          difficulty: entry.difficulty,
          puzzle: entry.puzzle,
          messages: [
            ...entry.messages,
            {
              role: 'assistant',
              content: result.reasoning
                ? `<think>\n${result.reasoning}\n</think>\n\n${result.response}`
                : result.response,
            },
          ],
        }

        return {
          index,
          entry,
          trainEntry,
          cost: totalCost,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          reasoningTokens: totalReasoningTokens,
          durationMs: totalDurationMs,
          attempts,
          usedFallback: true,
        }
      }
      log('Fallback validation failed')
    }
  }

  log('All attempts exhausted - marking as unsolved')
  // All attempts failed - mark as unsolved
  const trainEntry: TrainEntry = {
    puzzle_id: entry.puzzle_id,
    type: 'sokoban',
    difficulty: entry.difficulty,
    puzzle: entry.puzzle,
    messages: [
      ...entry.messages,
      {
        role: 'assistant',
        content: lastReasoning
          ? `<think>\n${lastReasoning}\n</think>\n\n${lastResponse}`
          : lastResponse,
      },
    ],
    unsolved: true,
  }

  return {
    index,
    entry,
    trainEntry,
    error: lastResult?.error,
    cost: totalCost,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    reasoningTokens: totalReasoningTokens,
    durationMs: totalDurationMs,
    attempts,
    usedFallback,
  }
}

async function processEntries(
  entries: TestEntry[],
  config: GenerationConfig,
  stats: GenerationStats,
): Promise<void> {
  const client = createOpenRouterClient()
  const limit = pLimit(config.concurrency)

  const startIdx = config.startIndex
  const endIdx = Math.min(startIdx + config.count, entries.length)
  const toProcess = entries.slice(startIdx, endIdx)

  console.log(
    `\nProcessing ${toProcess.length} entries with concurrency ${config.concurrency}...\n`,
  )

  let processedCount = 0

  const tasks = toProcess.map((entry, idx) =>
    limit(async () => {
      const globalIdx = startIdx + idx
      const result = await processOneEntry(
        client,
        entry,
        globalIdx,
        config.model,
        config.fallbackModel,
        config.maxRetries,
        config.verbose,
      )

      processedCount++
      const progress = `[${processedCount}/${toProcess.length}]`

      stats.totalCost += result.cost
      stats.totalInputTokens += result.inputTokens
      stats.totalOutputTokens += result.outputTokens
      stats.totalReasoningTokens += result.reasoningTokens

      if (result.trainEntry) {
        appendJsonlEntry(config.outputFile, result.trainEntry)

        if (result.trainEntry.unsolved) {
          stats.unsolved++
          const attemptsStr = result.usedFallback
            ? `${result.attempts} attempts + fallback`
            : `${result.attempts} attempts`
          console.log(
            `${progress} ${result.entry.puzzle_id} - UNSOLVED (${attemptsStr}, ${formatCost(result.cost)})`,
          )
        } else {
          stats.completed++
          if (result.usedFallback) {
            stats.solvedByFallback++
          } else {
            stats.solvedByPrimary++
          }
          const costStr = formatCost(result.cost)
          const tokensStr = `${result.inputTokens}/${result.outputTokens}`
          const reasoningStr = result.reasoningTokens > 0 ? ` +${result.reasoningTokens}r` : ''
          const attemptsStr = result.attempts > 1 ? ` [${result.attempts} attempts]` : ''
          const fallbackStr = result.usedFallback ? ' [fallback]' : ''
          console.log(
            `${progress} ${result.entry.puzzle_id} - OK (${costStr}, ${tokensStr}${reasoningStr}, ${result.durationMs}ms)${attemptsStr}${fallbackStr}`,
          )
        }
      } else if (result.error) {
        stats.failed++
        console.log(`${progress} ${result.entry.puzzle_id} - FAILED: ${result.error}`)
      }

      return result
    }),
  )

  await Promise.all(tasks)
}

// ============================================================================
// CLI Prompts
// ============================================================================

async function promptForConfig(): Promise<GenerationConfig> {
  console.log('\n🧩 Sokoban Solution Generator\n')

  // Check API key
  if (!hasOpenRouterApiKey()) {
    console.error('❌ OpenRouter API key not found.')
    console.error('   Set OPENROUTER_API_KEY environment variable.')
    process.exit(1)
  }
  console.log('✓  OpenRouter API key found\n')

  // Input file
  const defaultInput = 'data/raw/train.jsonl'
  const inputFile = await input({
    message: 'Input JSONL file:',
    default: defaultInput,
    validate: (value) => {
      if (!fs.existsSync(value)) {
        return `File not found: ${value}`
      }
      return true
    },
  })

  // Count entries
  const entries = await readJsonlFile(inputFile)
  console.log(`   Found ${entries.length} puzzles\n`)

  // Output file
  const defaultOutput = 'data/raw/train_with_reasoning.jsonl'
  const outputFile = await input({
    message: 'Output JSONL file:',
    default: defaultOutput,
  })

  // Check if output exists and handle resume
  let startIndex = 0
  if (fs.existsSync(outputFile)) {
    const existingContent = fs.readFileSync(outputFile, 'utf-8').trim()
    const existingCount = existingContent ? existingContent.split('\n').length : 0

    if (existingCount > 0) {
      console.log(`   Found ${existingCount} existing entries`)

      const resumeChoice = await select({
        message: 'Output file exists. What would you like to do?',
        choices: [
          { name: `Resume from entry ${existingCount + 1}`, value: 'resume' },
          { name: 'Overwrite (start fresh)', value: 'overwrite' },
          { name: 'Cancel', value: 'cancel' },
        ],
      })

      if (resumeChoice === 'cancel') {
        console.log('\n👋 Cancelled\n')
        process.exit(0)
      }

      if (resumeChoice === 'resume') {
        startIndex = existingCount
      } else {
        fs.writeFileSync(outputFile, '')
      }
    }
  }

  // Model selection
  const modelChoices = OPENROUTER_MODELS.map((m) => ({
    name: `${m.name} - ${m.description}`,
    value: m.id,
  }))

  const model = await select({
    message: 'Select primary model:',
    choices: modelChoices,
    pageSize: modelChoices.length,
  })

  // Fallback model selection
  const fallbackChoices = [{ name: 'None (no fallback)', value: '' }, ...modelChoices]

  const fallbackModel = await select({
    message: 'Select fallback model (used after 3 failed attempts):',
    choices: fallbackChoices,
    pageSize: fallbackChoices.length,
  })

  // Number to process
  const remaining = entries.length - startIndex
  const countStr = await input({
    message: `Number of puzzles to process (max ${remaining}):`,
    default: String(remaining),
    validate: (value) => {
      const num = Number.parseInt(value, 10)
      if (Number.isNaN(num) || num < 1 || num > remaining) {
        return `Must be between 1 and ${remaining}`
      }
      return true
    },
  })
  const count = Number.parseInt(countStr, 10)

  // Concurrency
  const concurrencyStr = await input({
    message: 'Concurrency (parallel requests):',
    default: '20',
    validate: (value) => {
      const num = Number.parseInt(value, 10)
      if (Number.isNaN(num) || num < 1 || num > 100) {
        return 'Must be between 1 and 100'
      }
      return true
    },
  })
  const concurrency = Number.parseInt(concurrencyStr, 10)

  // Max retries
  const maxRetriesStr = await input({
    message: 'Max retries per puzzle (before fallback):',
    default: String(DEFAULT_MAX_RETRIES),
    validate: (value) => {
      const num = Number.parseInt(value, 10)
      if (Number.isNaN(num) || num < 1 || num > 10) {
        return 'Must be between 1 and 10'
      }
      return true
    },
  })
  const maxRetries = Number.parseInt(maxRetriesStr, 10)

  // Verbose logging
  const verbose = await confirm({
    message: 'Enable verbose logging?',
    default: false,
  })

  return {
    model,
    fallbackModel: fallbackModel || null,
    inputFile,
    outputFile,
    concurrency,
    count,
    startIndex,
    maxRetries,
    verbose,
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\n👋 Cancelled\n')
    process.exit(0)
  })

  try {
    const config = await promptForConfig()

    // Show summary
    const modelName = OPENROUTER_MODELS.find((m) => m.id === config.model)?.name ?? config.model
    const fallbackName = config.fallbackModel
      ? (OPENROUTER_MODELS.find((m) => m.id === config.fallbackModel)?.name ?? config.fallbackModel)
      : 'None'

    console.log('\n📋 Configuration:')
    console.log(`   Primary Model: ${modelName} (${config.model})`)
    console.log(
      `   Fallback Model: ${fallbackName}${config.fallbackModel ? ` (${config.fallbackModel})` : ''}`,
    )
    console.log(`   Max Retries: ${config.maxRetries}`)
    console.log(`   Input: ${config.inputFile}`)
    console.log(`   Output: ${config.outputFile}`)
    console.log(`   Count: ${config.count} (starting from ${config.startIndex + 1})`)
    console.log(`   Concurrency: ${config.concurrency}`)
    console.log(`   Verbose: ${config.verbose ? 'Yes' : 'No'}`)

    const proceed = await confirm({
      message: 'Start generation?',
      default: true,
    })

    if (!proceed) {
      console.log('\n👋 Cancelled\n')
      return
    }

    // Read entries
    const entries = await readJsonlFile(config.inputFile)

    // Initialize stats
    const stats: GenerationStats = {
      total: config.count,
      completed: 0,
      solvedByPrimary: 0,
      solvedByFallback: 0,
      failed: 0,
      unsolved: 0,
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalReasoningTokens: 0,
    }

    const startTime = Date.now()

    // Process entries
    await processEntries(entries, config, stats)

    const totalTime = Date.now() - startTime

    // Print summary
    console.log(`\n${'='.repeat(50)}`)
    console.log('📊 Generation Complete\n')
    console.log(`   Solved: ${stats.completed}/${stats.total}`)
    console.log(`   - Primary model: ${stats.solvedByPrimary}`)
    if (config.fallbackModel) {
      console.log(`   - Fallback model: ${stats.solvedByFallback}`)
    }
    console.log(`   Unsolved: ${stats.unsolved}`)
    console.log(`   Failed: ${stats.failed}`)
    console.log(`   Total Cost: ${formatCost(stats.totalCost)}`)
    console.log(`   Total Tokens: ${stats.totalInputTokens + stats.totalOutputTokens}`)
    if (stats.totalReasoningTokens > 0) {
      console.log(`   Reasoning Tokens: ${stats.totalReasoningTokens}`)
    }
    console.log(`   Total Time: ${formatDuration(totalTime)}`)
    console.log(`   Avg Time/Puzzle: ${formatDuration(totalTime / stats.total)}`)
    console.log(`\n   Output: ${config.outputFile}`)
    console.log('')
  } catch (error) {
    if (error instanceof ExitPromptError) {
      console.log('\n\n👋 Cancelled\n')
      process.exit(0)
    }
    throw error
  }
}

main().catch((error) => {
  console.error('\nFatal error:', error.message)
  process.exit(1)
})
