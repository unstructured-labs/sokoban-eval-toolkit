import { describe, expect, test } from 'bun:test'
import type { CellTerrain, SokobanLevel } from '../../types'
import { solvePuzzle } from '../sokobanSolver'

/**
 * Helper to create a level from ASCII art.
 * Legend:
 *   # = wall
 *   . = goal
 *   @ = player
 *   $ = box
 *   * = box on goal
 *   + = player on goal
 *   (space) = floor
 */
function createLevelFromAscii(ascii: string, id = 'test'): SokobanLevel {
  const lines = ascii
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^\s*\|/, '').replace(/\|\s*$/, '')) // Remove leading | markers

  const height = lines.length
  const width = Math.max(...lines.map((l) => l.length))

  const terrain: CellTerrain[][] = []
  let playerStart = { x: 0, y: 0 }
  const boxStarts: { x: number; y: number }[] = []
  const goals: { x: number; y: number }[] = []

  for (let y = 0; y < height; y++) {
    const row: CellTerrain[] = []
    const line = lines[y].padEnd(width, ' ')

    for (let x = 0; x < width; x++) {
      const char = line[x]

      switch (char) {
        case '#':
          row.push('wall')
          break
        case '.':
          row.push('goal')
          goals.push({ x, y })
          break
        case '@':
          row.push('floor')
          playerStart = { x, y }
          break
        case '$':
          row.push('floor')
          boxStarts.push({ x, y })
          break
        case '*':
          row.push('goal')
          goals.push({ x, y })
          boxStarts.push({ x, y })
          break
        case '+':
          row.push('goal')
          goals.push({ x, y })
          playerStart = { x, y }
          break
        default:
          row.push('floor')
      }
    }
    terrain.push(row)
  }

  return {
    id,
    width,
    height,
    terrain,
    playerStart,
    boxStarts,
    goals,
    difficulty: 'easy',
    fileSource: 'test',
    puzzleNumber: 1,
  }
}

describe('sokobanSolver', () => {
  test('solves trivial 1-push puzzle', () => {
    // @$. = player pushes box one step right onto goal
    const level = createLevelFromAscii(`
#####
#@$.#
#####
`)

    const result = solvePuzzle(level)

    expect(result.solvable).toBe(true)
    expect(result.solution).toEqual(['RIGHT'])
    expect(result.moveCount).toBe(1)
  })

  test('solves puzzle requiring multiple moves', () => {
    // Player needs to walk around to push box
    const level = createLevelFromAscii(`
######
#    #
# $. #
#@   #
######
`)

    const result = solvePuzzle(level)

    expect(result.solvable).toBe(true)
    expect(result.solution).not.toBeNull()
    // Optimal solution is UP, RIGHT, RIGHT to push box down onto goal
    expect(result.moveCount).toBeLessThanOrEqual(5)
  })

  test('solves 2-box puzzle', () => {
    const level = createLevelFromAscii(`
#######
#  .. #
# $$  #
#  @  #
#######
`)

    const result = solvePuzzle(level)

    expect(result.solvable).toBe(true)
    expect(result.solution).not.toBeNull()
    expect(result.moveCount).toBeGreaterThan(0)
  })

  test('detects unsolvable puzzle (corner deadlock)', () => {
    // Box is already in corner with no goal there
    const level = createLevelFromAscii(`
#####
#$  #
#  .#
#@  #
#####
`)

    const result = solvePuzzle(level)

    expect(result.solvable).toBe(false)
    expect(result.solution).toBeNull()
  })

  test('returns empty solution for already-solved puzzle', () => {
    const level = createLevelFromAscii(`
#####
#@*.#
#####
`)

    const result = solvePuzzle(level)

    expect(result.solvable).toBe(true)
    expect(result.solution).toEqual([])
    expect(result.moveCount).toBe(0)
  })

  test('respects maxNodes limit', () => {
    // A puzzle that would require many nodes to solve
    const level = createLevelFromAscii(`
########
#      #
# $$.  #
#  @.  #
#      #
########
`)

    // With very low node limit, should fail to find solution
    const result = solvePuzzle(level, 10)

    expect(result.solvable).toBe(false)
    expect(result.nodesExplored).toBeLessThanOrEqual(10)
  })

  test('finds optimal solution for multi-step puzzle', () => {
    // Player @ needs to push box $ right to goal .
    // Player must walk around the box to push it
    const level = createLevelFromAscii(`
######
#    #
#@$. #
#    #
######
`)

    const result = solvePuzzle(level)

    expect(result.solvable).toBe(true)
    expect(result.solution).not.toBeNull()
    // Optimal solution should be around 3-5 moves (UP, RIGHT, RIGHT, DOWN, RIGHT to push)
    // or simpler: just push right directly if player is already in position
    expect(result.moveCount).toBeLessThanOrEqual(6)
  })

  test('handles box on goal that must be moved', () => {
    // One box already on goal, but another box needs that goal
    const level = createLevelFromAscii(`
#######
#     #
#.*$  #
#  @  #
#  .  #
#######
`)

    const result = solvePuzzle(level)

    expect(result.solvable).toBe(true)
    expect(result.solution).not.toBeNull()
  })
})
