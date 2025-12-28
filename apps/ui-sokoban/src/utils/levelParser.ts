import type { CellTerrain, Difficulty, GameState, Position, SokobanLevel } from '@src/types'

/**
 * Boxoban ASCII format:
 * # = wall
 * @ = player (on floor)
 * + = player on goal
 * $ = box (on floor)
 * * = box on goal
 * . = goal (empty)
 * (space) or - = floor
 */

export function parseLevel(
  ascii: string,
  id: string,
  difficulty: Difficulty = 'medium',
  fileSource = 'unknown',
  puzzleNumber = 0,
): SokobanLevel {
  const lines = ascii.trim().split('\n')
  const height = lines.length
  const width = Math.max(...lines.map((l) => l.length))

  const terrain: CellTerrain[][] = []
  let playerStart: Position | null = null
  const boxStarts: Position[] = []
  const goals: Position[] = []

  for (let y = 0; y < height; y++) {
    const row: CellTerrain[] = []
    const line = lines[y] || ''

    for (let x = 0; x < width; x++) {
      const char = line[x] || ' '

      switch (char) {
        case '#':
          row.push('wall')
          break

        case '@': // player on floor
          row.push('floor')
          playerStart = { x, y }
          break

        case '+': // player on goal
          row.push('goal')
          goals.push({ x, y })
          playerStart = { x, y }
          break

        case '$': // box on floor
          row.push('floor')
          boxStarts.push({ x, y })
          break

        case '*': // box on goal
          row.push('goal')
          goals.push({ x, y })
          boxStarts.push({ x, y })
          break

        case '.': // empty goal
          row.push('goal')
          goals.push({ x, y })
          break
        default:
          row.push('floor')
          break
      }
    }

    terrain.push(row)
  }

  if (!playerStart) {
    throw new Error(`No player position found in level ${id}`)
  }

  return {
    id,
    width,
    height,
    terrain,
    playerStart,
    boxStarts,
    goals,
    difficulty,
    fileSource,
    puzzleNumber,
  }
}

/**
 * Parse a file containing multiple puzzles separated by semicolons.
 * Format: "; N" where N is the puzzle number, followed by the puzzle grid.
 */
export function parseLevelFile(
  content: string,
  difficulty: Difficulty,
  filename: string,
): SokobanLevel[] {
  const levels: SokobanLevel[] = []

  // Split by semicolon lines (puzzle separators)
  // Format: "; 1" or ";1" followed by puzzle
  const puzzleBlocks = content.split(/^;\s*\d+\s*$/m).filter((block) => block.trim())

  for (let i = 0; i < puzzleBlocks.length; i++) {
    const block = puzzleBlocks[i].trim()
    if (!block) continue

    try {
      const id = `${difficulty}-${filename}-${i + 1}`
      const level = parseLevel(block, id, difficulty, filename, i + 1)
      levels.push(level)
    } catch (error) {
      console.warn(`Failed to parse puzzle ${i + 1} in ${filename}:`, error)
    }
  }

  return levels
}

/**
 * Convert current game state back to ASCII representation.
 * Useful for prompts and debugging.
 */
export function gameStateToAscii(state: GameState): string {
  const { level, playerPos, boxes } = state
  const lines: string[] = []

  for (let y = 0; y < level.height; y++) {
    let line = ''
    for (let x = 0; x < level.width; x++) {
      const terrain = level.terrain[y]?.[x] || 'floor'
      const isPlayer = playerPos.x === x && playerPos.y === y
      const isBox = boxes.some((b) => b.x === x && b.y === y)
      const isGoal = terrain === 'goal'

      if (terrain === 'wall') {
        line += '#'
      } else if (isPlayer && isGoal) {
        line += '+'
      } else if (isPlayer) {
        line += '@'
      } else if (isBox && isGoal) {
        line += '*'
      } else if (isBox) {
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
 * Convert game state to ASCII with coordinate labels.
 */
export function gameStateToAsciiWithCoords(state: GameState): string {
  const { level } = state
  const ascii = gameStateToAscii(state)
  const lines = ascii.split('\n')

  // Add column headers (with | to match row end markers)
  let header = '   '
  for (let x = 0; x < level.width; x++) {
    header += x % 10
  }
  header += '|'

  const numberedLines = lines.map((line, y) => {
    const rowNum = y.toString().padStart(2, ' ')
    return `${rowNum} ${line}`
  })

  return [header, ...numberedLines].join('\n')
}

/**
 * Convert a level to ASCII representation using initial positions.
 * Useful for showing the original puzzle state.
 */
export function levelToAscii(level: SokobanLevel): string {
  const { playerStart, boxStarts } = level
  const lines: string[] = []

  for (let y = 0; y < level.height; y++) {
    let line = ''
    for (let x = 0; x < level.width; x++) {
      const terrain = level.terrain[y]?.[x] || 'floor'
      const isPlayer = playerStart.x === x && playerStart.y === y
      const isBox = boxStarts.some((b) => b.x === x && b.y === y)
      const isGoal = terrain === 'goal'

      if (terrain === 'wall') {
        line += '#'
      } else if (isPlayer && isGoal) {
        line += '+'
      } else if (isPlayer) {
        line += '@'
      } else if (isBox && isGoal) {
        line += '*'
      } else if (isBox) {
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
 * Convert a level to ASCII with coordinate labels using initial positions.
 */
export function levelToAsciiWithCoords(level: SokobanLevel): string {
  const ascii = levelToAscii(level)
  const lines = ascii.split('\n')

  // Add column headers (with | to match row end markers)
  let header = '   '
  for (let x = 0; x < level.width; x++) {
    header += x % 10
  }
  header += '|'

  const numberedLines = lines.map((line, y) => {
    const rowNum = y.toString().padStart(2, ' ')
    return `${rowNum} ${line}`
  })

  return [header, ...numberedLines].join('\n')
}
