import { MEDIUM_LEVELS_RAW } from '@src/data/mediumLevels'
import type { SokobanLevel } from '@src/types'
import { parseLevelFile } from './levelParser'

// Cache parsed medium levels
let mediumLevelsCache: SokobanLevel[] | null = null

/**
 * Get all medium levels (parsed from embedded data).
 */
export function getMediumLevels(): SokobanLevel[] {
  if (!mediumLevelsCache) {
    mediumLevelsCache = parseLevelFile(MEDIUM_LEVELS_RAW, 'medium', 'embedded')
  }
  return mediumLevelsCache
}

/**
 * Get a specific medium level by index (0-based).
 */
export function getMediumLevel(index: number): SokobanLevel | null {
  const levels = getMediumLevels()
  if (index < 0 || index >= levels.length) {
    return null
  }
  return levels[index]
}

/**
 * Get the total number of medium levels available.
 */
export function getMediumLevelCount(): number {
  return getMediumLevels().length
}

/**
 * Get a random medium level.
 */
export function getRandomMediumLevel(): SokobanLevel {
  const levels = getMediumLevels()
  return levels[Math.floor(Math.random() * levels.length)]
}
