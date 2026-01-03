#!/usr/bin/env bun

/**
 * Generate Sokoban eval sets with interactive CLI.
 *
 * Difficulty presets:
 * - Very Easy: 5x5/6x6, 1 box only
 * - Easy: 4x4-10x10, 40% 1-box, 35% 2-box, 25% 3-box
 * - Custom: User-defined distribution
 *
 * Usage: bun run scripts/generate-sokoban.ts
 */

import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { ExitPromptError } from '@inquirer/core'
import { confirm, input, select } from '@inquirer/prompts'
import { EVAL_OUTPUT_FORMAT_INSTRUCTIONS } from '@sokoban-eval-toolkit/utils'

import type {
  CellTerrain,
  MoveDirection,
  Position,
  SokobanLevel,
} from '../apps/ui-sokoban/src/types'
import { solvePuzzle } from '../apps/ui-sokoban/src/utils/sokobanSolver'

// ============================================================================
// Types
// ============================================================================

type DifficultyPreset = 'very-easy' | 'standard' | 'custom'

/**
 * Difficulty level configuration:
 * - veryEasy: 1 box/goal, small board (5x5/6x6), NO internal walls
 * - easy: 1 box/goal, larger board (4x10), WITH walls
 * - medium: 2 boxes/goals, WITH walls
 * - hard: 3 boxes/goals, WITH walls
 * - veryHard: 4 boxes/goals, WITH walls
 */
interface DifficultyDistribution {
  veryEasy: number // 1 box, small, no walls
  easy: number // 1 box, larger, walls
  medium: number // 2 boxes, walls
  hard: number // 3 boxes, walls
  veryHard: number // 4 boxes, walls
}

interface GenerationConfig {
  preset: DifficultyPreset
  totalCount: number
  distribution: DifficultyDistribution
  outputDir: string
  trainTestSplit: number // percentage for test set (0-100)
}

interface GeneratedLevel {
  width: number
  height: number
  terrain: CellTerrain[][]
  playerStart: Position
  boxStarts: Position[]
  goals: Position[]
  solutionLength: number
  solution: MoveDirection[]
  numBoxes: number
}

const DIRECTIONS: { dir: MoveDirection; dx: number; dy: number }[] = [
  { dir: 'UP', dx: 0, dy: -1 },
  { dir: 'DOWN', dx: 0, dy: 1 },
  { dir: 'LEFT', dx: -1, dy: 0 },
  { dir: 'RIGHT', dx: 1, dy: 0 },
]

function isWalkable(
  x: number,
  y: number,
  terrain: CellTerrain[][],
  width: number,
  height: number,
): boolean {
  if (x < 0 || x >= width || y < 0 || y >= height) return false
  const cell = terrain[y]?.[x]
  return cell === 'floor' || cell === 'goal'
}

function isSolved(boxes: Position[], goals: Position[]): boolean {
  if (boxes.length === 0 && goals.length === 0) return true
  if (boxes.length !== goals.length) return false
  const goalSet = new Set(goals.map((g) => `${g.x},${g.y}`))
  return boxes.every((b) => goalSet.has(`${b.x},${b.y}`))
}

/**
 * Replay a solution to validate it actually solves the puzzle.
 * Returns true if the solution leads to a solved state.
 */
function validateSolution(
  terrain: CellTerrain[][],
  width: number,
  height: number,
  playerStart: Position,
  boxStarts: Position[],
  goals: Position[],
  solution: MoveDirection[],
): boolean {
  let player = { ...playerStart }
  const boxes = boxStarts.map((b) => ({ ...b }))

  for (const move of solution) {
    const dir = DIRECTIONS.find((d) => d.dir === move)
    if (!dir) return false

    const newPlayerX = player.x + dir.dx
    const newPlayerY = player.y + dir.dy

    // Check if player can move there
    if (!isWalkable(newPlayerX, newPlayerY, terrain, width, height)) {
      return false
    }

    // Check if there's a box to push
    const boxIndex = boxes.findIndex((b) => b.x === newPlayerX && b.y === newPlayerY)

    if (boxIndex !== -1) {
      const newBoxX = newPlayerX + dir.dx
      const newBoxY = newPlayerY + dir.dy

      // Check if box can be pushed
      if (!isWalkable(newBoxX, newBoxY, terrain, width, height)) {
        return false
      }
      if (boxes.some((b) => b.x === newBoxX && b.y === newBoxY)) {
        return false
      }

      // Move the box
      boxes[boxIndex] = { x: newBoxX, y: newBoxY }
    }

    // Move the player
    player = { x: newPlayerX, y: newPlayerY }
  }

  // Check if solved after all moves
  return isSolved(boxes, goals)
}

// ============================================================================
// LEVEL GENERATION
// ============================================================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Generate a short hash ID from puzzle ASCII.
 * Returns an 8-character hex string.
 */
function hashPuzzle(asciiLines: string[]): string {
  const content = asciiLines.join('\n')
  return createHash('sha256').update(content).digest('hex').slice(0, 8)
}

interface LevelGenOptions {
  numBoxes: number
  minSize: number
  maxSize: number
  withWalls: boolean
  maxAttempts?: number
}

/**
 * Generate a level with the specified options.
 */
function generateLevel(options: LevelGenOptions): GeneratedLevel | null {
  const { numBoxes, minSize, maxSize, withWalls, maxAttempts = 1000 } = options

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Random size within range
    const size = randomInt(minSize, maxSize)
    const width = size
    const height = size

    // Create terrain with border walls
    const terrain: CellTerrain[][] = []
    for (let y = 0; y < height; y++) {
      const row: CellTerrain[] = []
      for (let x = 0; x < width; x++) {
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          row.push('wall')
        } else {
          row.push('floor')
        }
      }
      terrain.push(row)
    }

    // Add sparse internal walls if enabled and board is large enough
    if (withWalls && size >= 6 && numBoxes > 0) {
      const interiorPositions: Position[] = []
      for (let y = 2; y < height - 2; y++) {
        for (let x = 2; x < width - 2; x++) {
          interiorPositions.push({ x, y })
        }
      }

      const maxWallCount = Math.min(Math.floor(interiorPositions.length * 0.1), 5)
      const numWallsToAdd = randomInt(0, maxWallCount)

      const shuffled = shuffle(interiorPositions)
      for (let i = 0; i < numWallsToAdd && i < shuffled.length; i++) {
        const pos = shuffled[i]
        terrain[pos.y][pos.x] = 'wall'
      }
    }

    // Get all floor positions
    const floorPositions: Position[] = []
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (terrain[y][x] === 'floor') {
          floorPositions.push({ x, y })
        }
      }
    }

    // Need enough space for player + boxes + goals
    if (floorPositions.length < 1 + numBoxes * 2) {
      continue
    }

    const shuffledFloors = shuffle(floorPositions)

    // Place player
    const playerStart = shuffledFloors[0]

    if (numBoxes === 0) {
      // Trivial puzzle - no boxes, no goals
      return {
        width,
        height,
        terrain,
        playerStart,
        boxStarts: [],
        goals: [],
        solutionLength: 0,
        solution: [],
        numBoxes: 0,
      }
    }

    // Place goals
    const goals: Position[] = []
    for (let i = 1; i <= numBoxes && i < shuffledFloors.length; i++) {
      const pos = shuffledFloors[i]
      goals.push(pos)
      terrain[pos.y][pos.x] = 'goal'
    }

    if (goals.length < numBoxes) continue

    // Place boxes (not on goals, not on player)
    const boxStarts: Position[] = []
    const usedPositions = new Set([
      `${playerStart.x},${playerStart.y}`,
      ...goals.map((g) => `${g.x},${g.y}`),
    ])

    for (let i = numBoxes + 1; i < shuffledFloors.length && boxStarts.length < numBoxes; i++) {
      const pos = shuffledFloors[i]
      const key = `${pos.x},${pos.y}`
      if (!usedPositions.has(key)) {
        boxStarts.push(pos)
        usedPositions.add(key)
      }
    }

    if (boxStarts.length < numBoxes) continue

    // Create a SokobanLevel object for the A* solver
    const level: SokobanLevel = {
      id: `gen_${attempt}`,
      width,
      height,
      terrain,
      playerStart,
      boxStarts,
      goals,
      difficulty: 'lmiq-reasoning-easy',
      fileSource: 'generated',
      puzzleNumber: attempt,
    }

    // Use the A* Push-Level solver (much faster than BFS for complex puzzles)
    const result = solvePuzzle(level, 50000)

    if (result.solvable && result.solution) {
      // Validate solution is non-trivial (at least 1 move)
      if (result.solution.length === 0) {
        continue
      }

      // Validate solution by replaying it
      const isValid = validateSolution(
        terrain,
        width,
        height,
        playerStart,
        boxStarts,
        goals,
        result.solution,
      )

      if (!isValid) {
        console.warn('Solution validation failed - skipping puzzle')
        continue
      }

      return {
        width,
        height,
        terrain,
        playerStart,
        boxStarts,
        goals,
        solutionLength: result.moveCount,
        solution: result.solution,
        numBoxes,
      }
    }
  }

  return null
}

/**
 * Convert a level to ASCII format.
 */
function levelToAscii(level: GeneratedLevel): string {
  const lines: string[] = []

  for (let y = 0; y < level.height; y++) {
    let line = ''
    for (let x = 0; x < level.width; x++) {
      const isPlayer = level.playerStart.x === x && level.playerStart.y === y
      const isBox = level.boxStarts.some((b) => b.x === x && b.y === y)
      const terrain = level.terrain[y][x]
      const isGoal = terrain === 'goal'

      if (isPlayer && isGoal) {
        line += '+'
      } else if (isPlayer) {
        line += '@'
      } else if (isBox && isGoal) {
        line += '*'
      } else if (isBox) {
        line += '$'
      } else if (isGoal) {
        line += '.'
      } else if (terrain === 'wall') {
        line += '#'
      } else {
        line += '-'
      }
    }
    lines.push(line)
  }

  return lines.join('\n')
}

/**
 * Convert a level to an array of ASCII strings (for JSONL puzzle field).
 */
function levelToAsciiArray(level: GeneratedLevel): string[] {
  const lines: string[] = []

  for (let y = 0; y < level.height; y++) {
    let line = ''
    for (let x = 0; x < level.width; x++) {
      const isPlayer = level.playerStart.x === x && level.playerStart.y === y
      const isBox = level.boxStarts.some((b) => b.x === x && b.y === y)
      const terrain = level.terrain[y][x]
      const isGoal = terrain === 'goal'

      if (isPlayer && isGoal) {
        line += '+'
      } else if (isPlayer) {
        line += '@'
      } else if (isBox && isGoal) {
        line += '*'
      } else if (isBox) {
        line += '$'
      } else if (isGoal) {
        line += '.'
      } else if (terrain === 'wall') {
        line += '#'
      } else {
        line += '-'
      }
    }
    lines.push(line)
  }

  return lines
}

type DifficultyLevel = 'very-easy' | 'easy' | 'medium' | 'hard' | 'very-hard'

/**
 * Get difficulty label for display.
 */
function getDifficultyLabel(difficulty: DifficultyLevel): string {
  switch (difficulty) {
    case 'very-easy':
      return 'Very Easy'
    case 'easy':
      return 'Easy'
    case 'medium':
      return 'Medium'
    case 'hard':
      return 'Hard'
    case 'very-hard':
      return 'Very Hard'
  }
}

/**
 * Format a position as r{row}c{col} (1-indexed).
 */
function formatPosition(pos: Position): string {
  return `r${pos.y + 1}c${pos.x + 1}`
}

/**
 * Generate coordinate locations string for player, boxes, and goals.
 */
function generateCoordinates(level: GeneratedLevel): string {
  const lines: string[] = []

  lines.push(`Player: ${formatPosition(level.playerStart)}`)

  if (level.boxStarts.length > 0) {
    const boxCoords = level.boxStarts.map(formatPosition).join(', ')
    lines.push(`Boxes: ${boxCoords}`)
  }

  if (level.goals.length > 0) {
    const goalCoords = level.goals.map(formatPosition).join(', ')
    lines.push(`Goals: ${goalCoords}`)
  }

  return lines.join('\n')
}

/**
 * Generate JSONL entry for training (includes assistant response).
 */
function generateTrainEntry(
  level: GeneratedLevel & { id: string },
  puzzleId: string,
  difficulty: DifficultyLevel,
): Record<string, unknown> {
  const puzzleArray = levelToAsciiArray(level)
  const puzzleStr = puzzleArray.join('\n')
  const coordinates = generateCoordinates(level)

  const systemPrompt = 'You are a puzzle-solving assistant. Think step by step.'
  const userPrompt = `Solve this Sokoban puzzle:

${puzzleStr}

Legend: # wall, @ player, $ box, . goal, * box on goal, + player on goal, - empty

${coordinates}

${EVAL_OUTPUT_FORMAT_INSTRUCTIONS}`

  const assistantResponse = `<think>
I am visualizing the board... The solution is clear.
</think>

{"solution": ${JSON.stringify(level.solution)}}`

  return {
    id: level.id,
    type: 'sokoban',
    puzzle_id: puzzleId,
    difficulty,
    puzzle: puzzleArray,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
      { role: 'assistant', content: assistantResponse },
    ],
  }
}

/**
 * Generate JSONL entry for testing (no assistant response).
 */
function generateTestEntry(
  level: GeneratedLevel & { id: string },
  puzzleId: string,
  difficulty: DifficultyLevel,
): Record<string, unknown> {
  const puzzleArray = levelToAsciiArray(level)
  const puzzleStr = puzzleArray.join('\n')
  const coordinates = generateCoordinates(level)

  const systemPrompt = 'You are a puzzle-solving assistant. Think step by step.'
  const userPrompt = `Solve this Sokoban puzzle:

${puzzleStr}

Legend: # wall, @ player, $ box, . goal, * box on goal, + player on goal, - empty

${coordinates}

${EVAL_OUTPUT_FORMAT_INSTRUCTIONS}`

  return {
    id: level.id,
    type: 'sokoban',
    puzzle_id: puzzleId,
    difficulty,
    puzzle: puzzleArray,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  }
}

// ============================================================================
// CLI Prompts
// ============================================================================

async function promptForConfig(): Promise<GenerationConfig> {
  console.log('\n🧩 LMIQ Eval Generator\n')

  // Difficulty preset selection
  const preset = (await select({
    message: 'Select difficulty preset:',
    choices: [
      {
        name: 'Very Easy Only - 5x5/6x6 boards, 1 box, no walls (baseline testing)',
        value: 'very-easy',
      },
      {
        name: 'Standard Eval - Mixed difficulties (25/25/25/20/5%)',
        value: 'standard',
      },
      {
        name: 'Custom - Define your own distribution',
        value: 'custom',
      },
    ],
  })) as DifficultyPreset

  // Total count
  const countStr = await input({
    message: 'Number of puzzles to generate:',
    default: '100',
    validate: (value) => {
      const num = Number.parseInt(value, 10)
      if (Number.isNaN(num) || num < 1 || num > 10000) {
        return 'Must be between 1 and 10000'
      }
      return true
    },
  })
  const totalCount = Number.parseInt(countStr, 10)

  let distribution: DifficultyDistribution

  if (preset === 'very-easy') {
    distribution = {
      veryEasy: totalCount,
      easy: 0,
      medium: 0,
      hard: 0,
      veryHard: 0,
    }
  } else if (preset === 'standard') {
    // Standard eval: 25% very easy, 25% easy, 25% medium, 20% hard, 5% very hard
    distribution = {
      veryEasy: Math.round(totalCount * 0.25),
      easy: Math.round(totalCount * 0.25),
      medium: Math.round(totalCount * 0.25),
      hard: Math.round(totalCount * 0.2),
      veryHard: Math.round(totalCount * 0.05),
    }
    // Adjust for rounding errors
    const sum =
      distribution.veryEasy +
      distribution.easy +
      distribution.medium +
      distribution.hard +
      distribution.veryHard
    if (sum < totalCount) {
      distribution.veryEasy += totalCount - sum
    }
  } else {
    // Custom preset
    console.log('\nDifficulty levels:')
    console.log('  • Very Easy: 1 box/goal, small board (5x5/6x6), NO internal walls')
    console.log('  • Easy: 1 box/goal, larger board (4x10), WITH walls')
    console.log('  • Medium: 2 boxes/goals, WITH walls')
    console.log('  • Hard: 3 boxes/goals, WITH walls')
    console.log('  • Very Hard: 4 boxes/goals, WITH walls')
    console.log('\nEnter distribution percentages (must sum to 100):')

    const veryEasyStr = await input({
      message: 'Very Easy %:',
      default: '25',
      validate: (value) => {
        const num = Number.parseInt(value, 10)
        if (Number.isNaN(num) || num < 0 || num > 100) {
          return 'Must be between 0 and 100'
        }
        return true
      },
    })
    const veryEasyPct = Number.parseInt(veryEasyStr, 10)

    const easyStr = await input({
      message: 'Easy %:',
      default: '25',
      validate: (value) => {
        const num = Number.parseInt(value, 10)
        if (Number.isNaN(num) || num < 0 || num > 100 - veryEasyPct) {
          return `Must be between 0 and ${100 - veryEasyPct}`
        }
        return true
      },
    })
    const easyPct = Number.parseInt(easyStr, 10)

    const mediumStr = await input({
      message: 'Medium %:',
      default: '25',
      validate: (value) => {
        const num = Number.parseInt(value, 10)
        if (Number.isNaN(num) || num < 0 || num > 100 - veryEasyPct - easyPct) {
          return `Must be between 0 and ${100 - veryEasyPct - easyPct}`
        }
        return true
      },
    })
    const mediumPct = Number.parseInt(mediumStr, 10)

    const hardStr = await input({
      message: 'Hard %:',
      default: '20',
      validate: (value) => {
        const num = Number.parseInt(value, 10)
        if (Number.isNaN(num) || num < 0 || num > 100 - veryEasyPct - easyPct - mediumPct) {
          return `Must be between 0 and ${100 - veryEasyPct - easyPct - mediumPct}`
        }
        return true
      },
    })
    const hardPct = Number.parseInt(hardStr, 10)

    const veryHardPct = 100 - veryEasyPct - easyPct - mediumPct - hardPct
    console.log(`   Very Hard: ${veryHardPct}%`)

    distribution = {
      veryEasy: Math.round(totalCount * (veryEasyPct / 100)),
      easy: Math.round(totalCount * (easyPct / 100)),
      medium: Math.round(totalCount * (mediumPct / 100)),
      hard: Math.round(totalCount * (hardPct / 100)),
      veryHard: Math.round(totalCount * (veryHardPct / 100)),
    }

    // Adjust for rounding errors
    const sum =
      distribution.veryEasy +
      distribution.easy +
      distribution.medium +
      distribution.hard +
      distribution.veryHard
    if (sum < totalCount) {
      distribution.veryEasy += totalCount - sum
    }
  }

  // Output directory
  const outputDir = await input({
    message: 'Output directory:',
    default: 'data/sokoban',
  })

  // Train/test split
  const splitStr = await input({
    message: 'Test set percentage (0-50):',
    default: '10',
    validate: (value) => {
      const num = Number.parseInt(value, 10)
      if (Number.isNaN(num) || num < 0 || num > 50) {
        return 'Must be between 0 and 50'
      }
      return true
    },
  })
  const trainTestSplit = Number.parseInt(splitStr, 10)

  return {
    preset,
    totalCount,
    distribution,
    outputDir,
    trainTestSplit,
  }
}

function getPresetLabel(preset: DifficultyPreset): string {
  switch (preset) {
    case 'very-easy':
      return 'Very Easy Only'
    case 'standard':
      return 'Standard Eval'
    case 'custom':
      return 'Custom'
  }
}

// ============================================================================
// MAIN
// ============================================================================

interface GeneratedLevelWithId extends GeneratedLevel {
  id: string
  difficulty: DifficultyLevel
}

/**
 * Difficulty category configuration for level generation.
 */
interface DifficultyConfig {
  difficulty: DifficultyLevel
  numBoxes: number
  minSize: number
  maxSize: number
  withWalls: boolean
}

const DIFFICULTY_CONFIGS: DifficultyConfig[] = [
  { difficulty: 'very-easy', numBoxes: 1, minSize: 5, maxSize: 6, withWalls: false },
  { difficulty: 'easy', numBoxes: 1, minSize: 4, maxSize: 10, withWalls: true },
  { difficulty: 'medium', numBoxes: 2, minSize: 4, maxSize: 10, withWalls: true },
  { difficulty: 'hard', numBoxes: 3, minSize: 4, maxSize: 10, withWalls: true },
  { difficulty: 'very-hard', numBoxes: 4, minSize: 5, maxSize: 10, withWalls: true },
]

async function generatePuzzles(config: GenerationConfig): Promise<GeneratedLevelWithId[]> {
  const levels: GeneratedLevelWithId[] = []
  const seenHashes = new Set<string>()

  // Map distribution to difficulty configs
  const categories: [DifficultyConfig, number][] = [
    [DIFFICULTY_CONFIGS[0], config.distribution.veryEasy],
    [DIFFICULTY_CONFIGS[1], config.distribution.easy],
    [DIFFICULTY_CONFIGS[2], config.distribution.medium],
    [DIFFICULTY_CONFIGS[3], config.distribution.hard],
    [DIFFICULTY_CONFIGS[4], config.distribution.veryHard],
  ]

  for (const [diffConfig, count] of categories) {
    if (count === 0) continue

    console.log(`Generating ${count} ${getDifficultyLabel(diffConfig.difficulty)} puzzles...`)

    let generated = 0
    let duplicates = 0
    const maxDuplicateAttempts = count * 10 // Prevent infinite loops

    while (generated < count && duplicates < maxDuplicateAttempts) {
      const level = generateLevel({
        numBoxes: diffConfig.numBoxes,
        minSize: diffConfig.minSize,
        maxSize: diffConfig.maxSize,
        withWalls: diffConfig.withWalls,
      })

      if (level) {
        const ascii = levelToAsciiArray(level)
        const hash = hashPuzzle(ascii)

        if (seenHashes.has(hash)) {
          duplicates++
          continue
        }

        seenHashes.add(hash)
        levels.push({ ...level, id: hash, difficulty: diffConfig.difficulty })
        generated++
      } else {
        // Try again with more attempts
        const retry = generateLevel({
          numBoxes: diffConfig.numBoxes,
          minSize: diffConfig.minSize,
          maxSize: diffConfig.maxSize,
          withWalls: diffConfig.withWalls,
          maxAttempts: 5000,
        })

        if (retry) {
          const ascii = levelToAsciiArray(retry)
          const hash = hashPuzzle(ascii)

          if (seenHashes.has(hash)) {
            duplicates++
            continue
          }

          seenHashes.add(hash)
          levels.push({ ...retry, id: hash, difficulty: diffConfig.difficulty })
          generated++
        } else {
          console.error('Failed to generate puzzle after extended attempts')
          duplicates++
        }
      }
    }

    if (duplicates > 0) {
      console.log(`   (skipped ${duplicates} duplicates)`)
    }

    if (generated < count) {
      console.warn(`   Only generated ${generated}/${count} unique puzzles`)
    }
  }

  return shuffle(levels)
}

async function main(): Promise<void> {
  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\n👋 Cancelled\n')
    process.exit(0)
  })

  try {
    const config = await promptForConfig()

    // Show summary
    console.log('\n📋 Configuration:')
    console.log(`   Preset: ${getPresetLabel(config.preset)}`)
    console.log(`   Total Puzzles: ${config.totalCount}`)
    console.log('   Distribution:')
    console.log(`     Very Easy: ${config.distribution.veryEasy} (1 box, 5x5-6x6, no walls)`)
    console.log(`     Easy:      ${config.distribution.easy} (1 box, 4x10, walls)`)
    console.log(`     Medium:    ${config.distribution.medium} (2 boxes, walls)`)
    console.log(`     Hard:      ${config.distribution.hard} (3 boxes, walls)`)
    console.log(`     Very Hard: ${config.distribution.veryHard} (4 boxes, walls)`)
    console.log(`   Output Directory: ${config.outputDir}`)
    console.log(`   Train/Test Split: ${100 - config.trainTestSplit}% / ${config.trainTestSplit}%`)

    const proceed = await confirm({
      message: 'Start generation?',
      default: true,
    })

    if (!proceed) {
      console.log('\n👋 Cancelled\n')
      return
    }

    console.log('\n')

    // Generate puzzles
    const shuffledLevels = await generatePuzzles(config)

    if (shuffledLevels.length === 0) {
      console.error('No puzzles generated!')
      return
    }

    // Generate TypeScript file content
    const asciiLevels = shuffledLevels.map((level, idx) => {
      const ascii = levelToAscii(level)
      return `; ${idx}\n${ascii}`
    })

    const fileContent = `// LMIQ Reasoning ${getPresetLabel(config.preset)} eval set
// Generated with: bun run scripts/generate-sokoban.ts
// Total puzzles: ${shuffledLevels.length}
// Distribution: Very Easy=${config.distribution.veryEasy}, Easy=${config.distribution.easy}, Medium=${config.distribution.medium}, Hard=${config.distribution.hard}, Very Hard=${config.distribution.veryHard}

export const LMIQ_REASONING_EASY_LEVELS_RAW = \`${asciiLevels.join('\n\n')}\`
`

    const outputPath = resolve(process.cwd(), 'apps/ui-sokoban/src/data/lmiqReasoningEasyLevels.ts')

    await writeFile(outputPath, fileContent)

    console.log(`\nGenerated ${shuffledLevels.length} puzzles`)
    console.log(`Written to: ${outputPath}`)

    // ============================================================================
    // JSONL GENERATION (Train/Test Split)
    // ============================================================================

    const dataDir = resolve(process.cwd(), config.outputDir)
    await mkdir(dataDir, { recursive: true })

    // Split based on config
    const testSize = Math.max(
      config.trainTestSplit > 0 ? 1 : 0,
      Math.round(shuffledLevels.length * (config.trainTestSplit / 100)),
    )
    const testLevels = shuffledLevels.slice(0, testSize)
    const trainLevels = shuffledLevels.slice(testSize)

    console.log(`\nSplit: ${trainLevels.length} train, ${testLevels.length} test`)

    // Generate train entries
    const trainBaseEntries: string[] = []
    const trainWithSolutionsEntries: string[] = []
    for (let i = 0; i < trainLevels.length; i++) {
      const level = trainLevels[i]
      const puzzleId = `lmiq_train_${level.width}x${level.height}_${String(i).padStart(3, '0')}`
      trainBaseEntries.push(JSON.stringify(generateTestEntry(level, puzzleId, level.difficulty))) // No solution
      trainWithSolutionsEntries.push(
        JSON.stringify(generateTrainEntry(level, puzzleId, level.difficulty)),
      ) // With solution
    }

    // Generate test entries (without solutions - for LLM evaluation)
    const testEntries: string[] = []
    for (let i = 0; i < testLevels.length; i++) {
      const level = testLevels[i]
      const puzzleId = `lmiq_test_${level.width}x${level.height}_${String(i).padStart(3, '0')}`
      testEntries.push(JSON.stringify(generateTestEntry(level, puzzleId, level.difficulty)))
    }

    // Write train.jsonl (base - no solutions, for LLM to solve)
    const trainPath = resolve(dataDir, 'train.jsonl')
    await writeFile(trainPath, `${trainBaseEntries.join('\n')}\n`)

    // Write train_with_solutions.jsonl (with programmatic solutions)
    const trainWithSolutionsPath = resolve(dataDir, 'train_with_solutions.jsonl')
    await writeFile(trainWithSolutionsPath, `${trainWithSolutionsEntries.join('\n')}\n`)

    // Write test.jsonl (without solutions)
    const testPath = resolve(dataDir, 'test.jsonl')
    await writeFile(testPath, `${testEntries.join('\n')}\n`)

    console.log('\nJSONL files written:')
    console.log(`  Train (base):           ${trainPath} (${trainLevels.length} puzzles)`)
    console.log(
      `  Train (with solutions): ${trainWithSolutionsPath} (${trainLevels.length} puzzles)`,
    )
    console.log(`  Test:                   ${testPath} (${testLevels.length} puzzles)`)

    // Print stats
    const stats = {
      total: shuffledLevels.length,
      avgSolutionLength:
        shuffledLevels.reduce((sum, l) => sum + l.solutionLength, 0) / shuffledLevels.length,
      sizeDistribution: {} as Record<string, number>,
      difficultyDistribution: {} as Record<string, number>,
    }

    for (const level of shuffledLevels) {
      const sizeKey = `${level.width}x${level.height}`
      stats.sizeDistribution[sizeKey] = (stats.sizeDistribution[sizeKey] || 0) + 1

      const diffKey = getDifficultyLabel(level.difficulty)
      stats.difficultyDistribution[diffKey] = (stats.difficultyDistribution[diffKey] || 0) + 1
    }

    console.log('\n📊 Stats:')
    console.log(`   Average solution length: ${stats.avgSolutionLength.toFixed(1)} moves`)
    console.log('   Size distribution:', stats.sizeDistribution)
    console.log('   Difficulty distribution:', stats.difficultyDistribution)
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
