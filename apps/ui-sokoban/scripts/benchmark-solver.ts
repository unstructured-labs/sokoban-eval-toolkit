#!/usr/bin/env bun
/**
 * Benchmark script for the Sokoban solver.
 * Runs the solver against all boxoban medium, hard, and microban levels.
 * Caches solutions to a JSON file for faster subsequent runs.
 *
 * Usage: bun run scripts/benchmark-solver.ts
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { BOXOBAN_HARD_LEVELS_RAW } from '../src/data/boxobanHardLevels'
import { BOXOBAN_MEDIUM_LEVELS_RAW } from '../src/data/boxobanMediumLevels'
import { MICROBAN_LEVELS_RAW } from '../src/data/microbanLevels'
import type { MoveDirection, SokobanLevel } from '../src/types'
import { levelToAscii, parseLevelFile } from '../src/utils/levelParser'
import { solvePuzzle } from '../src/utils/sokobanSolver'

// Cache file path (same directory as script)
const CACHE_FILE = new URL('./solution-cache.json', import.meta.url).pathname

// Lite cache file path (in src/data for UI consumption)
const LITE_CACHE_FILE = new URL('../src/data/solutionCacheLite.json', import.meta.url).pathname

/** Cached solution entry with metadata */
interface CacheEntry {
  /** Source identifier (e.g., "Boxoban Hard #329") */
  source: string
  /** Solution as compact string (e.g., "rruulldd") */
  solution: string | null
  /** Whether the puzzle was solved */
  solved: boolean
  /** Whether the solver hit the node limit */
  hitLimit: boolean
  /** Number of nodes explored */
  nodesExplored: number
  /** Time to solve in milliseconds */
  timeMs: number
  /** Move count (length of solution) */
  moveCount: number
  /** Timestamp when this was cached */
  cachedAt: string
  /** Solver version/config for cache invalidation */
  solverVersion: string
}

/** Full cache structure */
interface SolutionCache {
  [hash: string]: CacheEntry
}

// Current solver version - bump this to invalidate cache when solver changes
const SOLVER_VERSION = '3.0.0-push-astar-150k'

// Maximum nodes to explore before giving up
const MAX_NODES = 150000

/**
 * Convert a level to a unique hash for cache key.
 * Uses SHA-256 of the ASCII representation.
 */
function hashLevel(level: SokobanLevel): string {
  const ascii = levelToAscii(level)
  return createHash('sha256').update(ascii).digest('hex').substring(0, 16)
}

/**
 * Convert MoveDirection[] to compact string notation.
 * u=up, d=down, l=left, r=right
 */
function movesToString(moves: MoveDirection[]): string {
  return moves
    .map((m) => {
      switch (m) {
        case 'UP':
          return 'u'
        case 'DOWN':
          return 'd'
        case 'LEFT':
          return 'l'
        case 'RIGHT':
          return 'r'
      }
    })
    .join('')
}

/**
 * Load cache from disk, or return empty cache.
 */
function loadCache(): SolutionCache {
  try {
    if (existsSync(CACHE_FILE)) {
      const data = readFileSync(CACHE_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (_error) {
    console.warn('Warning: Could not load cache file, starting fresh')
  }
  return {}
}

/**
 * Save cache to disk.
 */
function saveCache(cache: SolutionCache): void {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2))
    console.log(`\nCache saved to ${CACHE_FILE}`)
  } catch (error) {
    console.error('Error saving cache:', error)
  }
}

/** Lite cache structure: hash -> solution string */
interface LiteSolutionCache {
  [hash: string]: string
}

/**
 * Generate and save the lite cache for UI consumption.
 * Only includes solved puzzles with their solution strings.
 */
function saveLiteCache(cache: SolutionCache): void {
  const liteCache: LiteSolutionCache = {}

  for (const [hash, entry] of Object.entries(cache)) {
    // Only include solved puzzles with valid solutions
    if (entry.solved && entry.solution) {
      liteCache[hash] = entry.solution
    }
  }

  try {
    writeFileSync(LITE_CACHE_FILE, JSON.stringify(liteCache, null, 2))
    const solvedCount = Object.keys(liteCache).length
    console.log(`Lite cache saved to ${LITE_CACHE_FILE} (${solvedCount} solutions)`)
  } catch (error) {
    console.error('Error saving lite cache:', error)
  }
}

interface BenchmarkResult {
  total: number
  solved: number
  unsolvable: number
  hitLimit: number
  totalNodes: number
  totalTimeMs: number
  totalMoveCount: number
  cacheHits: number
}

function runBenchmark(
  name: string,
  sourceName: string,
  levels: SokobanLevel[],
  cache: SolutionCache,
): BenchmarkResult {
  const result: BenchmarkResult = {
    total: levels.length,
    solved: 0,
    unsolvable: 0,
    hitLimit: 0,
    totalNodes: 0,
    totalTimeMs: 0,
    totalMoveCount: 0,
    cacheHits: 0,
  }

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i]
    const hash = hashLevel(level)

    // Check cache first (must match solver version)
    const cached = cache[hash]
    if (cached && cached.solverVersion === SOLVER_VERSION) {
      result.cacheHits++
      result.totalNodes += cached.nodesExplored
      result.totalTimeMs += cached.timeMs
      result.totalMoveCount += cached.moveCount

      if (cached.solved) {
        result.solved++
      } else if (cached.hitLimit) {
        result.hitLimit++
      } else {
        result.unsolvable++
      }
      continue
    }

    // Solve and cache
    const start = performance.now()
    const solverResult = solvePuzzle(level, MAX_NODES)
    const elapsed = performance.now() - start

    result.totalTimeMs += elapsed
    result.totalNodes += solverResult.nodesExplored
    result.totalMoveCount += solverResult.moveCount

    if (solverResult.solvable) {
      result.solved++
    } else if (solverResult.hitLimit) {
      result.hitLimit++
    } else {
      result.unsolvable++
    }

    // Store in cache
    cache[hash] = {
      source: `${sourceName} #${i + 1}`,
      solution: solverResult.solution ? movesToString(solverResult.solution) : null,
      solved: solverResult.solvable,
      hitLimit: solverResult.hitLimit,
      nodesExplored: solverResult.nodesExplored,
      timeMs: Math.round(elapsed * 100) / 100,
      moveCount: solverResult.moveCount,
      cachedAt: new Date().toISOString(),
      solverVersion: SOLVER_VERSION,
    }

    // Progress indicator every 100 levels
    if ((i + 1) % 100 === 0) {
      process.stdout.write(`  ${name}: ${i + 1}/${levels.length}\r`)
    }
  }

  // Clear progress line
  process.stdout.write(`${' '.repeat(50)}\r`)

  return result
}

function printSummary(name: string, result: BenchmarkResult) {
  const solvedPct = ((result.solved / result.total) * 100).toFixed(1)
  const hitLimitPct = ((result.hitLimit / result.total) * 100).toFixed(1)
  const unsolvablePct = ((result.unsolvable / result.total) * 100).toFixed(1)
  const avgNodes = Math.round(result.totalNodes / result.total)
  const avgTimeMs = (result.totalTimeMs / result.total).toFixed(2)
  const avgSolutionLen =
    result.solved > 0 ? (result.totalMoveCount / result.solved).toFixed(1) : 'N/A'
  const cacheHitPct = ((result.cacheHits / result.total) * 100).toFixed(1)

  console.log(`\n${'='.repeat(60)}`)
  console.log(`${name} Benchmark Results`)
  console.log('='.repeat(60))
  console.log(`Total levels:     ${result.total}`)
  console.log(`Solved:           ${result.solved} (${solvedPct}%)`)
  console.log(`Hit limit:        ${result.hitLimit} (${hitLimitPct}%)`)
  console.log(`Unsolvable:       ${result.unsolvable} (${unsolvablePct}%)`)
  console.log(`Avg nodes/level:  ${avgNodes.toLocaleString()}`)
  console.log(`Avg time/level:   ${avgTimeMs}ms`)
  console.log(`Avg solution len: ${avgSolutionLen} moves`)
  console.log(`Total time:       ${(result.totalTimeMs / 1000).toFixed(2)}s`)
  console.log(`Cache hits:       ${result.cacheHits} (${cacheHitPct}%)`)
}

// Main
console.log('Sokoban Solver Benchmark')
console.log('========================\n')

// Load existing cache
console.log('Loading cache...')
const cache = loadCache()
const existingEntries = Object.keys(cache).length
console.log(`Cache contains ${existingEntries} entries`)

console.log('\nParsing levels...')
const mediumLevels = parseLevelFile(BOXOBAN_MEDIUM_LEVELS_RAW, 'medium', 'boxoban-medium')
const hardLevels = parseLevelFile(BOXOBAN_HARD_LEVELS_RAW, 'hard', 'boxoban-hard')
const microbanLevels = parseLevelFile(MICROBAN_LEVELS_RAW, 'microban', 'microban')

console.log(
  `Loaded: ${mediumLevels.length} medium, ${hardLevels.length} hard, ${microbanLevels.length} microban`,
)

console.log('\nRunning benchmarks (this may take a while)...')

// Run benchmarks
const mediumResult = runBenchmark('Medium', 'Boxoban Medium', mediumLevels, cache)
printSummary('Boxoban Medium', mediumResult)

const hardResult = runBenchmark('Hard', 'Boxoban Hard', hardLevels, cache)
printSummary('Boxoban Hard', hardResult)

const microbanResult = runBenchmark('Microban', 'Microban', microbanLevels, cache)
printSummary('Microban', microbanResult)

// Overall summary
const totalLevels = mediumResult.total + hardResult.total + microbanResult.total
const totalSolved = mediumResult.solved + hardResult.solved + microbanResult.solved
const totalHitLimit = mediumResult.hitLimit + hardResult.hitLimit + microbanResult.hitLimit
const totalUnsolvable = mediumResult.unsolvable + hardResult.unsolvable + microbanResult.unsolvable
const totalMoveCount =
  mediumResult.totalMoveCount + hardResult.totalMoveCount + microbanResult.totalMoveCount
const totalCacheHits = mediumResult.cacheHits + hardResult.cacheHits + microbanResult.cacheHits
const totalTime = mediumResult.totalTimeMs + hardResult.totalTimeMs + microbanResult.totalTimeMs
const avgSolutionLen = totalSolved > 0 ? (totalMoveCount / totalSolved).toFixed(1) : 'N/A'

console.log(`\n${'='.repeat(60)}`)
console.log('OVERALL SUMMARY')
console.log('='.repeat(60))
console.log(`Total levels:     ${totalLevels}`)
console.log(`Solved:           ${totalSolved} (${((totalSolved / totalLevels) * 100).toFixed(1)}%)`)
console.log(
  `Hit limit:        ${totalHitLimit} (${((totalHitLimit / totalLevels) * 100).toFixed(1)}%)`,
)
console.log(
  `Unsolvable:       ${totalUnsolvable} (${((totalUnsolvable / totalLevels) * 100).toFixed(1)}%)`,
)
console.log(`Avg solution len: ${avgSolutionLen} moves`)
console.log(
  `Cache hits:       ${totalCacheHits} (${((totalCacheHits / totalLevels) * 100).toFixed(1)}%)`,
)
console.log(`Total time:       ${(totalTime / 1000).toFixed(2)}s`)

// Save updated cache
const newEntries = Object.keys(cache).length - existingEntries
console.log(`\nNew solutions cached: ${newEntries}`)
saveCache(cache)
saveLiteCache(cache)
console.log('')
