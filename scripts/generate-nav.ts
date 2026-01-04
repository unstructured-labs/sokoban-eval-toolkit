#!/usr/bin/env bun

/**
 * Generate navigation eval sets with interactive CLI.
 *
 * Generates puzzles where a player (@) must navigate to a goal (G)
 * while avoiding walls (#) on a grid.
 *
 * Usage: bun run scripts/generate-nav.ts
 */

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { ExitPromptError } from '@inquirer/core'
import { confirm, input } from '@inquirer/prompts'
import { EVAL_OUTPUT_FORMAT_INSTRUCTIONS } from '@sokoban-eval-toolkit/utils'

// ============================================================================
// Types
// ============================================================================

interface Position {
  x: number
  y: number
}

type MoveDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

interface GenerationConfig {
  totalCount: number
  minSize: number
  maxSize: number
  minWalls: number
  maxWalls: number
  outputDir: string
  trainTestSplit: number
  appendMode: boolean
}

interface GeneratedPuzzle {
  width: number
  height: number
  puzzle: string[][] // '-' = empty, '#' = wall, '@' = player, 'G' = goal
  playerStart: Position
  goal: Position
  walls: Position[]
  shortestPath: MoveDirection[]
  pathLength: number
}

interface GeneratedPuzzleWithId extends GeneratedPuzzle {
  id: string
}

const DIRECTIONS: { dir: MoveDirection; dx: number; dy: number }[] = [
  { dir: 'UP', dx: 0, dy: -1 },
  { dir: 'DOWN', dx: 0, dy: 1 },
  { dir: 'LEFT', dx: -1, dy: 0 },
  { dir: 'RIGHT', dx: 1, dy: 0 },
]

// ============================================================================
// Pathfinding (BFS)
// ============================================================================

interface BFSState {
  x: number
  y: number
  path: MoveDirection[]
}

/**
 * Find shortest path using BFS.
 * Returns the path as an array of moves, or null if no path exists.
 */
function findShortestPath(
  width: number,
  height: number,
  walls: Set<string>,
  start: Position,
  goal: Position,
  maxSteps = 1000,
): MoveDirection[] | null {
  const visited = new Set<string>()
  const queue: BFSState[] = [{ x: start.x, y: start.y, path: [] }]

  visited.add(`${start.x},${start.y}`)

  let steps = 0
  while (queue.length > 0 && steps < maxSteps) {
    const current = queue.shift()
    if (!current) break
    steps++

    // Check if we reached the goal
    if (current.x === goal.x && current.y === goal.y) {
      return current.path
    }

    // Try all directions
    for (const { dir, dx, dy } of DIRECTIONS) {
      const nx = current.x + dx
      const ny = current.y + dy
      const key = `${nx},${ny}`

      // Check bounds
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue

      // Check walls
      if (walls.has(key)) continue

      // Check visited
      if (visited.has(key)) continue

      visited.add(key)
      queue.push({
        x: nx,
        y: ny,
        path: [...current.path, dir],
      })
    }
  }

  return null // No path found
}

/**
 * Validate a solution by replaying it.
 */
function validateSolution(
  width: number,
  height: number,
  walls: Set<string>,
  start: Position,
  goal: Position,
  solution: MoveDirection[],
): boolean {
  let x = start.x
  let y = start.y

  for (const move of solution) {
    const dir = DIRECTIONS.find((d) => d.dir === move)
    if (!dir) return false

    const nx = x + dir.dx
    const ny = y + dir.dy

    // Check bounds
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) return false

    // Check walls
    if (walls.has(`${nx},${ny}`)) return false

    x = nx
    y = ny
  }

  return x === goal.x && y === goal.y
}

// ============================================================================
// Puzzle Generation
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
 * Generate a short hash ID from puzzle grid.
 */
function hashPuzzle(gridLines: string[]): string {
  const content = gridLines.join('\n')
  return createHash('sha256').update(content).digest('hex').slice(0, 8)
}

/**
 * Generate a single puzzle.
 */
function generatePuzzle(
  minSize: number,
  maxSize: number,
  minWalls: number,
  maxWalls: number,
  maxAttempts = 100,
): GeneratedPuzzle | null {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const width = randomInt(minSize, maxSize)
    const height = randomInt(minSize, maxSize)

    // Get all positions
    const allPositions: Position[] = []
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        allPositions.push({ x, y })
      }
    }

    const shuffled = shuffle(allPositions)

    // Place player and goal
    const playerStart = shuffled[0]
    const goal = shuffled[1]

    // Don't place player and goal adjacent (too trivial)
    const dx = Math.abs(playerStart.x - goal.x)
    const dy = Math.abs(playerStart.y - goal.y)
    if (dx + dy <= 1) continue

    // Calculate max walls we can place (leave enough room for a path)
    const totalCells = width * height
    const maxPossibleWalls = Math.min(
      maxWalls,
      Math.floor(totalCells * 0.4), // Don't fill more than 40%
      totalCells - 2, // Leave room for player and goal
    )
    const numWalls = randomInt(minWalls, Math.max(minWalls, maxPossibleWalls))

    // Place walls (not on player or goal)
    const walls: Position[] = []
    const wallSet = new Set<string>()

    for (let i = 2; i < shuffled.length && walls.length < numWalls; i++) {
      const pos = shuffled[i]
      walls.push(pos)
      wallSet.add(`${pos.x},${pos.y}`)
    }

    // Find shortest path
    const path = findShortestPath(width, height, wallSet, playerStart, goal)

    if (path === null) continue // No valid path, try again

    // Validate the solution
    const isValid = validateSolution(width, height, wallSet, playerStart, goal, path)
    if (!isValid) {
      console.warn('Solution validation failed - skipping')
      continue
    }

    // Build the puzzle representation
    const puzzleGrid: string[][] = []
    for (let y = 0; y < height; y++) {
      const row: string[] = []
      for (let x = 0; x < width; x++) {
        if (x === playerStart.x && y === playerStart.y) {
          row.push('@')
        } else if (x === goal.x && y === goal.y) {
          row.push('G')
        } else if (wallSet.has(`${x},${y}`)) {
          row.push('#')
        } else {
          row.push('-')
        }
      }
      puzzleGrid.push(row)
    }

    return {
      width,
      height,
      puzzle: puzzleGrid,
      playerStart,
      goal,
      walls,
      shortestPath: path,
      pathLength: path.length,
    }
  }

  return null
}

/**
 * Convert puzzle grid to array of strings.
 */
function puzzleToLines(puzzle: string[][]): string[] {
  return puzzle.map((row) => row.join(''))
}

/**
 * Convert puzzle grid to display string.
 */
function puzzleToString(puzzle: string[][]): string {
  return puzzleToLines(puzzle).join('\n')
}

// ============================================================================
// JSONL Generation
// ============================================================================

/**
 * Generate the user prompt for a puzzle.
 */
function generateUserPrompt(puzzle: GeneratedPuzzle): string {
  const puzzleStr = puzzleToString(puzzle.puzzle)
  const playerRow = puzzle.playerStart.y + 1
  const playerCol = puzzle.playerStart.x + 1
  const goalRow = puzzle.goal.y + 1
  const goalCol = puzzle.goal.x + 1

  return `# Simple Navigation Puzzle

Move the player (@) to the goal (G) on a ${puzzle.height}x${puzzle.width} grid, while avoiding walls (#).

## Puzzle
\`\`\`
${puzzleStr}
\`\`\`

Legend:
- @ = Player (you)
- G = Goal (destination)
- # = Walls (Impassable)
- - = Empty cell

## Rules
- Valid moves: "UP", "DOWN", "LEFT", "RIGHT"
- Grid is ${puzzle.height} rows x ${puzzle.width} columns
- Player starts at row ${playerRow}, column ${playerCol}
- Goal is at row ${goalRow}, column ${goalCol}
- Walls (#) are impassable

${EVAL_OUTPUT_FORMAT_INSTRUCTIONS}`
}

/**
 * Generate JSONL entry for training (includes assistant response).
 */
function generateTrainEntry(puzzle: GeneratedPuzzleWithId): Record<string, unknown> {
  const puzzleLines = puzzleToLines(puzzle.puzzle)
  const systemPrompt = 'You are a navigation assistant specializing in 2D navigation challenges.'
  const userPrompt = generateUserPrompt(puzzle)
  const assistantResponse = `<think>
I am visualizing the board... The solution is clear.
</think>

{"solution": ${JSON.stringify(puzzle.shortestPath)}}`

  return {
    id: puzzle.id,
    type: 'navigation',
    width: puzzle.width,
    height: puzzle.height,
    numWalls: puzzle.walls.length,
    pathLength: puzzle.pathLength,
    shortestPath: puzzle.shortestPath,
    puzzle: puzzleLines,
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
function generateTestEntry(puzzle: GeneratedPuzzleWithId): Record<string, unknown> {
  const puzzleLines = puzzleToLines(puzzle.puzzle)
  const systemPrompt = 'You are a navigation assistant specializing in 2D navigation challenges.'
  const userPrompt = generateUserPrompt(puzzle)

  return {
    id: puzzle.id,
    type: 'navigation',
    width: puzzle.width,
    height: puzzle.height,
    numWalls: puzzle.walls.length,
    pathLength: puzzle.pathLength,
    shortestPath: puzzle.shortestPath,
    puzzle: puzzleLines,
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
  console.log('\n🧭 Simple Navigation Puzzle Generator\n')

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

  // Min board size
  const minSizeStr = await input({
    message: 'Minimum board size (width/height):',
    default: '4',
    validate: (value) => {
      const num = Number.parseInt(value, 10)
      if (Number.isNaN(num) || num < 3 || num > 20) {
        return 'Must be between 3 and 20'
      }
      return true
    },
  })
  const minSize = Number.parseInt(minSizeStr, 10)

  // Max board size
  const maxSizeStr = await input({
    message: 'Maximum board size (width/height):',
    default: '8',
    validate: (value) => {
      const num = Number.parseInt(value, 10)
      if (Number.isNaN(num) || num < minSize || num > 20) {
        return `Must be between ${minSize} and 20`
      }
      return true
    },
  })
  const maxSize = Number.parseInt(maxSizeStr, 10)

  // Min walls
  const minWallsStr = await input({
    message: 'Minimum walls per puzzle:',
    default: '0',
    validate: (value) => {
      const num = Number.parseInt(value, 10)
      if (Number.isNaN(num) || num < 0 || num > 50) {
        return 'Must be between 0 and 50'
      }
      return true
    },
  })
  const minWalls = Number.parseInt(minWallsStr, 10)

  // Max walls
  const maxWallsStr = await input({
    message: 'Maximum walls per puzzle:',
    default: '10',
    validate: (value) => {
      const num = Number.parseInt(value, 10)
      if (Number.isNaN(num) || num < minWalls || num > 100) {
        return `Must be between ${minWalls} and 100`
      }
      return true
    },
  })
  const maxWalls = Number.parseInt(maxWallsStr, 10)

  // Output directory
  const outputDir = await input({
    message: 'Output directory:',
    default: 'data/nav',
  })

  // Check if files exist and ask about append mode
  const trainPath = resolve(process.cwd(), outputDir, 'train.jsonl')
  const filesExist = existsSync(trainPath)
  let appendMode = false

  if (filesExist) {
    appendMode = await confirm({
      message: 'Existing files found. Append to existing files?',
      default: true,
    })
  }

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
    totalCount,
    minSize,
    maxSize,
    minWalls,
    maxWalls,
    outputDir,
    trainTestSplit,
    appendMode,
  }
}

// ============================================================================
// Main
// ============================================================================

async function generatePuzzles(
  config: GenerationConfig,
  existingHashes: Set<string> = new Set(),
): Promise<GeneratedPuzzleWithId[]> {
  const puzzles: GeneratedPuzzleWithId[] = []
  const seenHashes = new Set<string>(existingHashes)

  console.log(`Generating ${config.totalCount} puzzles...`)

  let generated = 0
  let duplicates = 0
  let failures = 0
  const maxFailures = config.totalCount * 10

  while (generated < config.totalCount && failures < maxFailures) {
    const puzzle = generatePuzzle(config.minSize, config.maxSize, config.minWalls, config.maxWalls)

    if (puzzle) {
      const lines = puzzleToLines(puzzle.puzzle)
      const hash = hashPuzzle(lines)

      if (seenHashes.has(hash)) {
        duplicates++
        continue
      }

      seenHashes.add(hash)
      puzzles.push({ ...puzzle, id: hash })
      generated++

      // Progress indicator
      if (generated % 10 === 0 || generated === config.totalCount) {
        process.stdout.write(`\r   Generated ${generated}/${config.totalCount}`)
      }
    } else {
      failures++
    }
  }

  console.log('') // New line after progress

  if (duplicates > 0) {
    console.log(`   (skipped ${duplicates} duplicates)`)
  }

  if (failures > 0) {
    console.log(`   (${failures} generation failures)`)
  }

  return shuffle(puzzles)
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
    console.log(`   Total Puzzles: ${config.totalCount}`)
    console.log(
      `   Board Size: ${config.minSize}x${config.minSize} to ${config.maxSize}x${config.maxSize}`,
    )
    console.log(`   Walls: ${config.minWalls} to ${config.maxWalls}`)
    console.log(`   Output Directory: ${config.outputDir}`)
    console.log(`   Train/Test Split: ${100 - config.trainTestSplit}% / ${config.trainTestSplit}%`)
    console.log(`   Mode: ${config.appendMode ? 'Append to existing files' : 'Create new files'}`)

    const proceed = await confirm({
      message: 'Start generation?',
      default: true,
    })

    if (!proceed) {
      console.log('\n👋 Cancelled\n')
      return
    }

    console.log('\n')

    // Load existing puzzle hashes if in append mode
    const existingHashes = new Set<string>()
    if (config.appendMode) {
      const trainPath = resolve(process.cwd(), config.outputDir, 'train.jsonl')
      if (existsSync(trainPath)) {
        try {
          const content = await readFile(trainPath, 'utf-8')
          for (const line of content.trim().split('\n')) {
            if (line) {
              const entry = JSON.parse(line)
              if (entry.id) {
                existingHashes.add(entry.id)
              }
            }
          }
          console.log(`   Loaded ${existingHashes.size} existing puzzle hashes`)
        } catch {
          console.warn('   Warning: Could not load existing puzzles for deduplication')
        }
      }
    }

    // Generate puzzles
    const puzzles = await generatePuzzles(config, existingHashes)

    if (puzzles.length === 0) {
      console.error('No puzzles generated!')
      return
    }

    // Create output directory
    const dataDir = resolve(process.cwd(), config.outputDir)
    await mkdir(dataDir, { recursive: true })

    // Split based on config
    const testSize = Math.max(
      config.trainTestSplit > 0 ? 1 : 0,
      Math.round(puzzles.length * (config.trainTestSplit / 100)),
    )
    const testPuzzles = puzzles.slice(0, testSize)
    const trainPuzzles = puzzles.slice(testSize)

    console.log(`\nSplit: ${trainPuzzles.length} train, ${testPuzzles.length} test`)

    // Generate train entries
    const trainBaseEntries: string[] = []
    const trainWithSolutionsEntries: string[] = []
    for (const puzzle of trainPuzzles) {
      trainBaseEntries.push(JSON.stringify(generateTestEntry(puzzle))) // No assistant response
      trainWithSolutionsEntries.push(JSON.stringify(generateTrainEntry(puzzle))) // With solution
    }

    // Generate test entries
    const testEntries: string[] = []
    for (const puzzle of testPuzzles) {
      testEntries.push(JSON.stringify(generateTestEntry(puzzle)))
    }

    // Write train.jsonl (base - no assistant response)
    const trainPath = resolve(dataDir, 'train.jsonl')
    // Write train_with_solutions.jsonl (with solutions)
    const trainWithSolutionsPath = resolve(dataDir, 'train_with_solutions.jsonl')
    // Write test.jsonl
    const testPath = resolve(dataDir, 'test.jsonl')

    if (config.appendMode) {
      // Append to existing files
      await appendFile(trainPath, `${trainBaseEntries.join('\n')}\n`)
      await appendFile(trainWithSolutionsPath, `${trainWithSolutionsEntries.join('\n')}\n`)
      await appendFile(testPath, `${testEntries.join('\n')}\n`)

      console.log('\nJSONL files appended:')
      console.log(`  Train (base):           ${trainPath} (+${trainPuzzles.length} puzzles)`)
      console.log(
        `  Train (with solutions): ${trainWithSolutionsPath} (+${trainPuzzles.length} puzzles)`,
      )
      console.log(`  Test:                   ${testPath} (+${testPuzzles.length} puzzles)`)
    } else {
      // Create new files
      await writeFile(trainPath, `${trainBaseEntries.join('\n')}\n`)
      await writeFile(trainWithSolutionsPath, `${trainWithSolutionsEntries.join('\n')}\n`)
      await writeFile(testPath, `${testEntries.join('\n')}\n`)

      console.log('\nJSONL files written:')
      console.log(`  Train (base):           ${trainPath} (${trainPuzzles.length} puzzles)`)
      console.log(
        `  Train (with solutions): ${trainWithSolutionsPath} (${trainPuzzles.length} puzzles)`,
      )
      console.log(`  Test:                   ${testPath} (${testPuzzles.length} puzzles)`)
    }

    // Print stats
    const stats = {
      total: puzzles.length,
      avgPathLength: puzzles.reduce((sum, p) => sum + p.pathLength, 0) / puzzles.length,
      avgWalls: puzzles.reduce((sum, p) => sum + p.walls.length, 0) / puzzles.length,
      sizeDistribution: {} as Record<string, number>,
      pathLengthDistribution: {} as Record<string, number>,
    }

    for (const puzzle of puzzles) {
      const sizeKey = `${puzzle.width}x${puzzle.height}`
      stats.sizeDistribution[sizeKey] = (stats.sizeDistribution[sizeKey] || 0) + 1

      const pathBucket =
        puzzle.pathLength <= 5
          ? '1-5'
          : puzzle.pathLength <= 10
            ? '6-10'
            : puzzle.pathLength <= 15
              ? '11-15'
              : '16+'
      stats.pathLengthDistribution[pathBucket] = (stats.pathLengthDistribution[pathBucket] || 0) + 1
    }

    console.log('\n📊 Stats:')
    console.log(`   Average path length: ${stats.avgPathLength.toFixed(1)} moves`)
    console.log(`   Average walls: ${stats.avgWalls.toFixed(1)}`)
    console.log('   Size distribution:', stats.sizeDistribution)
    console.log('   Path length distribution:', stats.pathLengthDistribution)
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
