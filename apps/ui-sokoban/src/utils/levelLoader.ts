import { BOXOBAN_HARD_LEVELS_RAW } from '@src/data/boxobanHardLevels'
import { BOXOBAN_MEDIUM_LEVELS_RAW } from '@src/data/boxobanMediumLevels'
import { LMIQ_REASONING_EASY_LEVELS_RAW } from '@src/data/lmiqReasoningEasyLevels'
import { MICROBAN_LEVELS_RAW } from '@src/data/microbanLevels'
import type { SokobanLevel } from '@src/types'
import { parseLevelFile } from './levelParser'

// Cache parsed medium levels
let mediumLevelsCache: SokobanLevel[] | null = null

// Cache parsed hard levels
let hardLevelsCache: SokobanLevel[] | null = null

// Cache parsed microban levels
let microbanLevelsCache: SokobanLevel[] | null = null

// Cache parsed LMIQ levels
let lmiqLevelsCache: SokobanLevel[] | null = null

/**
 * Get all medium levels (parsed from embedded data).
 */
export function getMediumLevels(): SokobanLevel[] {
  if (!mediumLevelsCache) {
    mediumLevelsCache = parseLevelFile(BOXOBAN_MEDIUM_LEVELS_RAW, 'classic', 'embedded')
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

/**
 * Get all hard levels (parsed from embedded data).
 */
export function getHardLevels(): SokobanLevel[] {
  if (!hardLevelsCache) {
    hardLevelsCache = parseLevelFile(BOXOBAN_HARD_LEVELS_RAW, 'classic-hard', 'boxoban-hard')
  }
  return hardLevelsCache
}

/**
 * Get a specific hard level by index (0-based).
 */
export function getHardLevel(index: number): SokobanLevel | null {
  const levels = getHardLevels()
  if (index < 0 || index >= levels.length) {
    return null
  }
  return levels[index]
}

/**
 * Get the total number of hard levels available.
 */
export function getHardLevelCount(): number {
  return getHardLevels().length
}

/**
 * Get a random hard level.
 */
export function getRandomHardLevel(): SokobanLevel {
  const levels = getHardLevels()
  return levels[Math.floor(Math.random() * levels.length)]
}

/**
 * Get all microban levels (parsed from embedded data).
 */
export function getMicrobanLevels(): SokobanLevel[] {
  if (!microbanLevelsCache) {
    microbanLevelsCache = parseLevelFile(MICROBAN_LEVELS_RAW, 'microban', 'microban')
  }
  return microbanLevelsCache
}

/**
 * Get a specific microban level by index (0-based).
 */
export function getMicrobanLevel(index: number): SokobanLevel | null {
  const levels = getMicrobanLevels()
  if (index < 0 || index >= levels.length) {
    return null
  }
  return levels[index]
}

/**
 * Get the total number of microban levels available.
 */
export function getMicrobanLevelCount(): number {
  return getMicrobanLevels().length
}

/**
 * Get a random microban level.
 */
export function getRandomMicrobanLevel(): SokobanLevel {
  const levels = getMicrobanLevels()
  return levels[Math.floor(Math.random() * levels.length)]
}

/**
 * Get all LMIQ Reasoning Easy levels (parsed from embedded data).
 */
export function getLmiqLevels(): SokobanLevel[] {
  if (!lmiqLevelsCache) {
    lmiqLevelsCache = parseLevelFile(
      LMIQ_REASONING_EASY_LEVELS_RAW,
      'lmiq-reasoning-easy',
      'lmiq-reasoning-easy',
    )
  }
  return lmiqLevelsCache
}

/**
 * Get a specific LMIQ level by index (0-based).
 */
export function getLmiqLevel(index: number): SokobanLevel | null {
  const levels = getLmiqLevels()
  if (index < 0 || index >= levels.length) {
    return null
  }
  return levels[index]
}

/**
 * Get the total number of LMIQ levels available.
 */
export function getLmiqLevelCount(): number {
  return getLmiqLevels().length
}

/**
 * Get a random LMIQ level.
 */
export function getRandomLmiqLevel(): SokobanLevel {
  const levels = getLmiqLevels()
  return levels[Math.floor(Math.random() * levels.length)]
}
