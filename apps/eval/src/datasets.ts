import { join } from 'node:path'
import type { Box, CellTerrain, Difficulty, SavedLayout, SokobanLevel } from './types'

// Path to UI app data directory (relative to this file's location)
const UI_DATA_DIR = join(import.meta.dir, '../../ui-sokoban/src/data')

/**
 * Available built-in datasets.
 */
export type DatasetId = 'microban' | 'boxoban-medium' | 'boxoban-hard'

export interface DatasetInfo {
  id: DatasetId
  name: string
  description: string
  difficulty: Difficulty
  filename: string
  exportName: string
}

export const DATASETS: DatasetInfo[] = [
  {
    id: 'microban',
    name: 'Microban',
    description: '155 beginner puzzles by David Skinner',
    difficulty: 'microban',
    filename: 'microbanLevels.ts',
    exportName: 'MICROBAN_LEVELS_RAW',
  },
  {
    id: 'boxoban-medium',
    name: 'Boxoban Medium',
    description: '1000 medium puzzles from DeepMind',
    difficulty: 'classic',
    filename: 'boxobanMediumLevels.ts',
    exportName: 'BOXOBAN_MEDIUM_LEVELS_RAW',
  },
  {
    id: 'boxoban-hard',
    name: 'Boxoban Hard',
    description: '1000 hard puzzles from DeepMind',
    difficulty: 'classic-hard',
    filename: 'boxobanHardLevels.ts',
    exportName: 'BOXOBAN_HARD_LEVELS_RAW',
  },
]

/**
 * Parse a single level from ASCII format.
 */
function parseLevel(
  ascii: string,
  id: string,
  difficulty: Difficulty,
  fileSource: string,
  puzzleNumber: number,
): SokobanLevel {
  const lines = ascii.trim().split('\n')
  const height = lines.length
  const width = Math.max(...lines.map((l) => l.length))

  const terrain: CellTerrain[][] = []
  let playerStart: { x: number; y: number } | null = null
  const boxStarts: Box[] = []
  const goals: { x: number; y: number }[] = []

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
          boxStarts.push({ x, y, color: 'orange' })
          break

        case '*': // box on goal
          row.push('goal')
          goals.push({ x, y })
          boxStarts.push({ x, y, color: 'orange' })
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
 */
function parseLevelFile(content: string, difficulty: Difficulty, filename: string): SokobanLevel[] {
  const levels: SokobanLevel[] = []

  // Split by semicolon lines (puzzle separators)
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
 * Extract the raw level string from a TypeScript file.
 */
async function extractRawLevels(filePath: string, exportName: string): Promise<string> {
  const content = await Bun.file(filePath).text()

  // Find the template literal content: export const NAME = `...`
  const pattern = new RegExp(`export const ${exportName}\\s*=\\s*\`([\\s\\S]*?)\``, 'm')
  const match = content.match(pattern)

  if (!match || !match[1]) {
    throw new Error(`Could not find ${exportName} in ${filePath}`)
  }

  return match[1]
}

/**
 * Load a built-in dataset and return as SavedLayout array.
 */
export async function loadDataset(datasetId: DatasetId): Promise<SavedLayout[]> {
  const dataset = DATASETS.find((d) => d.id === datasetId)
  if (!dataset) {
    throw new Error(`Unknown dataset: ${datasetId}`)
  }

  const filePath = join(UI_DATA_DIR, dataset.filename)

  // Check if file exists
  const file = Bun.file(filePath)
  if (!(await file.exists())) {
    throw new Error(`Dataset file not found: ${filePath}`)
  }

  // Extract and parse levels
  const rawLevels = await extractRawLevels(filePath, dataset.exportName)
  const levels = parseLevelFile(rawLevels, dataset.difficulty, dataset.id)

  // Convert to SavedLayout format
  return levels.map(
    (level, index): SavedLayout => ({
      id: level.id,
      name: `${dataset.name} #${index + 1}`,
      savedAt: Date.now(),
      order: index,
      difficulty: level.difficulty,
      width: level.width,
      height: level.height,
      terrain: level.terrain,
      playerStart: level.playerStart,
      boxStarts: level.boxStarts,
      goals: level.goals,
    }),
  )
}

/**
 * Get dataset info by ID.
 */
export function getDatasetInfo(datasetId: DatasetId): DatasetInfo | undefined {
  return DATASETS.find((d) => d.id === datasetId)
}
