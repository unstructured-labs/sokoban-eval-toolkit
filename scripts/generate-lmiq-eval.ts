/**
 * Generate LMIQ Reasoning Easy eval set.
 *
 * Distribution (percentages of total):
 * - 20% have 1 box
 * - 25% have 2 boxes
 * - 30% have 3 boxes
 * - 25% have 4 boxes
 *
 * Board sizes: 4x4 to 10x10 (random)
 *
 * Usage: bun run scripts/generate-lmiq-eval.ts [count]
 * Default count is 100.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import type {
  CellTerrain,
  MoveDirection,
  Position,
  SokobanLevel,
} from '../apps/ui-sokoban/src/types'
import { solvePuzzle } from '../apps/ui-sokoban/src/utils/sokobanSolver'

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
 * Generate a level with the specified number of boxes.
 */
function generateLevel(numBoxes: number, maxAttempts = 1000): GeneratedLevel | null {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Random size 4-10
    const size = randomInt(4, 10)
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

    // For larger grids, add some sparse internal walls
    if (size >= 6 && numBoxes > 0) {
      const interiorPositions: Position[] = []
      for (let y = 2; y < height - 2; y++) {
        for (let x = 2; x < width - 2; x++) {
          interiorPositions.push({ x, y })
        }
      }

      const maxWalls = Math.min(Math.floor(interiorPositions.length * 0.1), 5)
      const numWalls = randomInt(0, maxWalls)

      const shuffled = shuffle(interiorPositions)
      for (let i = 0; i < numWalls && i < shuffled.length; i++) {
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
        line += ' '
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
        line += ' '
      }
    }
    lines.push(line)
  }

  return lines
}

/**
 * Convert solution moves to compact U/D/L/R notation.
 */
function solutionToNotation(solution: MoveDirection[]): string {
  return solution
    .map((move) => {
      switch (move) {
        case 'UP':
          return 'U'
        case 'DOWN':
          return 'D'
        case 'LEFT':
          return 'L'
        case 'RIGHT':
          return 'R'
      }
    })
    .join('')
}

/**
 * Get difficulty label based on number of boxes.
 */
function getDifficulty(numBoxes: number): string {
  if (numBoxes <= 1) return 'easy'
  if (numBoxes <= 2) return 'easy-medium'
  if (numBoxes <= 3) return 'medium'
  return 'medium-hard'
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
function generateTrainEntry(level: GeneratedLevel, puzzleId: string): Record<string, unknown> {
  const puzzleArray = levelToAsciiArray(level)
  const puzzleStr = puzzleArray.join('\n')
  const solutionNotation = solutionToNotation(level.solution)
  const coordinates = generateCoordinates(level)

  const systemPrompt = 'You are a puzzle-solving assistant. Think step by step.'
  const userPrompt = `Solve this Sokoban puzzle:

${puzzleStr}

Legend: # wall, @ player, $ box, . goal, * box on goal, + player on goal

${coordinates}

Provide moves as: U (up), D (down), L (left), R (right).

Example solution: UUDLRRRDLR`

  const assistantResponse = `Solution: ${solutionNotation}`

  return {
    puzzle_id: puzzleId,
    difficulty: getDifficulty(level.numBoxes),
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
function generateTestEntry(level: GeneratedLevel, puzzleId: string): Record<string, unknown> {
  const puzzleArray = levelToAsciiArray(level)
  const puzzleStr = puzzleArray.join('\n')
  const coordinates = generateCoordinates(level)

  const systemPrompt = 'You are a puzzle-solving assistant. Think step by step.'
  const userPrompt = `Solve this Sokoban puzzle:

${puzzleStr}

Legend: # wall, @ player, $ box, . goal, * box on goal, + player on goal

${coordinates}

Provide moves as: U (up), D (down), L (left), R (right).

Example solution: UUDLRRRDLR`

  return {
    puzzle_id: puzzleId,
    difficulty: getDifficulty(level.numBoxes),
    puzzle: puzzleArray,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const totalCount = Number.parseInt(process.argv[2] || '100', 10)

  console.log(`Generating ${totalCount} LMIQ Reasoning Easy puzzles...`)

  // Calculate counts based on percentages
  const distribution = {
    boxes1: Math.round(totalCount * 0.4), // 40% - 1 box
    boxes2: Math.round(totalCount * 0.35), // 35% - 2 boxes
    boxes3: Math.round(totalCount * 0.25), // 25% - 3 boxes
    boxes4: Math.round(totalCount * 0.0), // 0% - 4 boxes
  }

  // Adjust for rounding errors
  const sum = distribution.boxes1 + distribution.boxes2 + distribution.boxes3 + distribution.boxes4
  if (sum < totalCount) {
    distribution.boxes1 += totalCount - sum
  }

  console.log('Distribution:', distribution)

  const levels: GeneratedLevel[] = []

  // Generate puzzles for each category
  const categories: [number, number][] = [
    [1, distribution.boxes1],
    [2, distribution.boxes2],
    [3, distribution.boxes3],
    [4, distribution.boxes4],
  ]

  for (const [numBoxes, count] of categories) {
    console.log(`Generating ${count} puzzles with ${numBoxes} boxes...`)

    for (let i = 0; i < count; i++) {
      const level = generateLevel(numBoxes)
      if (level) {
        levels.push(level)
      } else {
        console.warn(`Failed to generate puzzle with ${numBoxes} boxes (attempt ${i + 1})`)
        // Try again
        const retry = generateLevel(numBoxes, 5000)
        if (retry) {
          levels.push(retry)
        } else {
          console.error('Failed to generate puzzle after extended attempts')
        }
      }
    }
  }

  // Shuffle the final list so the distribution is mixed
  const shuffledLevels = shuffle(levels)

  // Generate TypeScript file content
  const asciiLevels = shuffledLevels.map((level, idx) => {
    const ascii = levelToAscii(level)
    return `; ${idx}\n${ascii}`
  })

  const fileContent = `// LMIQ Reasoning Easy eval set
// Generated with: bun run scripts/generate-lmiq-eval.ts ${totalCount}
// Total puzzles: ${shuffledLevels.length}
// Distribution: 1-box=${distribution.boxes1}, 2-box=${distribution.boxes2}, 3-box=${distribution.boxes3}, 4-box=${distribution.boxes4}

export const LMIQ_REASONING_EASY_LEVELS_RAW = \`${asciiLevels.join('\n\n')}\`
`

  const outputPath = resolve(process.cwd(), 'apps/ui-sokoban/src/data/lmiqReasoningEasyLevels.ts')

  await writeFile(outputPath, fileContent)

  console.log(`\nGenerated ${shuffledLevels.length} puzzles`)
  console.log(`Written to: ${outputPath}`)

  // ============================================================================
  // JSONL GENERATION (Train/Test Split)
  // ============================================================================

  const dataDir = resolve(process.cwd(), 'data/raw')
  await mkdir(dataDir, { recursive: true })

  // Split: 10% for test, 90% for train
  const testSize = Math.max(1, Math.round(shuffledLevels.length * 0.1))
  const testLevels = shuffledLevels.slice(0, testSize)
  const trainLevels = shuffledLevels.slice(testSize)

  console.log(`\nSplit: ${trainLevels.length} train, ${testLevels.length} test`)

  // Generate train entries (with solutions)
  const trainEntries: string[] = []
  for (let i = 0; i < trainLevels.length; i++) {
    const level = trainLevels[i]
    const puzzleId = `lmiq_train_${level.width}x${level.height}_${String(i).padStart(3, '0')}`
    trainEntries.push(JSON.stringify(generateTrainEntry(level, puzzleId)))
  }

  // Generate test entries (without solutions - for LLM evaluation)
  const testEntries: string[] = []
  for (let i = 0; i < testLevels.length; i++) {
    const level = testLevels[i]
    const puzzleId = `lmiq_test_${level.width}x${level.height}_${String(i).padStart(3, '0')}`
    testEntries.push(JSON.stringify(generateTestEntry(level, puzzleId)))
  }

  // Write train.jsonl (with solutions)
  const trainPath = resolve(dataDir, 'train.jsonl')
  await writeFile(trainPath, `${trainEntries.join('\n')}\n`)

  // Write test.jsonl (without solutions)
  const testPath = resolve(dataDir, 'test.jsonl')
  await writeFile(testPath, `${testEntries.join('\n')}\n`)

  console.log('\nJSONL files written:')
  console.log(`  Train: ${trainPath} (${trainLevels.length} puzzles)`)
  console.log(`  Test:  ${testPath} (${testLevels.length} puzzles)`)

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

    const diffKey = getDifficulty(level.numBoxes)
    stats.difficultyDistribution[diffKey] = (stats.difficultyDistribution[diffKey] || 0) + 1
  }

  console.log('\nStats:')
  console.log(`  Average solution length: ${stats.avgSolutionLength.toFixed(1)} moves`)
  console.log('  Size distribution:', stats.sizeDistribution)
  console.log('  Difficulty distribution:', stats.difficultyDistribution)
}

main().catch(console.error)
