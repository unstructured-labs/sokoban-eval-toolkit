import solutionCacheData from '../data/solutionCacheLite.json'
import type { MoveDirection, SokobanLevel } from '../types'
import { levelToAscii } from './levelParser'
import { solvePuzzle } from './sokobanSolver'

// The cache is imported directly as a JSON module
const solutionCache: Record<string, string> = solutionCacheData as Record<string, string>

// Node limit for runtime solving (lower than benchmark to keep UI responsive)
const RUNTIME_SOLVER_NODE_LIMIT = 25000

/**
 * Hash a level to match the benchmark cache key format.
 * Uses the same algorithm as the benchmark script (SHA-256, first 16 chars).
 */
async function hashLevel(level: SokobanLevel): Promise<string> {
  const ascii = levelToAscii(level)
  const encoder = new TextEncoder()
  const data = encoder.encode(ascii)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return hashHex.substring(0, 16)
}

/**
 * Convert compact solution string to MoveDirection array.
 * u=UP, d=DOWN, l=LEFT, r=RIGHT
 */
function solutionStringToMoves(solution: string): MoveDirection[] {
  return solution.split('').map((char) => {
    switch (char) {
      case 'u':
        return 'UP'
      case 'd':
        return 'DOWN'
      case 'l':
        return 'LEFT'
      case 'r':
        return 'RIGHT'
      default:
        throw new Error(`Invalid move character: ${char}`)
    }
  })
}

export interface SolutionFound {
  found: true
  solution: MoveDirection[]
  moveCount: number
  /** 'cache' if from pre-computed cache, 'solver' if computed at runtime */
  source: 'cache' | 'solver'
}

export interface SolutionNotFound {
  found: false
  /** True if the solver hit its node limit (puzzle may still be solvable) */
  hitLimit: boolean
}

export type SolutionResult = SolutionFound | SolutionNotFound

/**
 * Get a solution for a level, checking cache first then falling back to solver.
 *
 * @param level - The level to solve
 * @param options - Optional settings
 * @param options.cacheOnly - If true, only check cache (don't run solver)
 * @param options.maxNodes - Override the default node limit for runtime solving
 */
export async function getSolution(
  level: SokobanLevel,
  options?: { cacheOnly?: boolean; maxNodes?: number },
): Promise<SolutionResult> {
  // Check cache first
  const hash = await hashLevel(level)
  const cachedSolution = solutionCache[hash]

  if (cachedSolution) {
    const solution = solutionStringToMoves(cachedSolution)
    return {
      found: true,
      solution,
      moveCount: solution.length,
      source: 'cache',
    }
  }

  // Cache miss - run solver if allowed
  if (options?.cacheOnly) {
    return { found: false, hitLimit: false }
  }

  const nodeLimit = options?.maxNodes ?? RUNTIME_SOLVER_NODE_LIMIT
  const result = solvePuzzle(level, nodeLimit)

  if (result.solvable && result.solution) {
    return {
      found: true,
      solution: result.solution,
      moveCount: result.moveCount,
      source: 'solver',
    }
  }

  return {
    found: false,
    hitLimit: result.hitLimit,
  }
}

/**
 * Check if we have any cached solutions available.
 */
export function hasCachedSolutions(): boolean {
  return Object.keys(solutionCache).length > 0
}

/**
 * Get the number of cached solutions.
 */
export function getCachedSolutionCount(): number {
  return Object.keys(solutionCache).length
}

// Legacy exports for backwards compatibility
export type CachedSolution = SolutionFound
export type CachedSolutionNotFound = SolutionNotFound
export type CachedSolutionResult = SolutionResult
export const getCachedSolution = getSolution
