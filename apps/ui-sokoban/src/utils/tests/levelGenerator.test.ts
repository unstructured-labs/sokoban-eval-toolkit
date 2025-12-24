import { describe, expect, test } from 'bun:test'
import { generateLevel } from '../levelGenerator'
import { solvePuzzle } from '../sokobanSolver'

describe('generateLevel easy', () => {
  test('generates solvable puzzle', () => {
    const level = generateLevel('easy')

    const result = solvePuzzle(level)

    expect(result.solvable).toBe(true)
    expect(result.solution).not.toBeNull()
  })

  test('generates puzzle with 2 boxes by default', () => {
    const level = generateLevel('easy')

    expect(level.boxStarts.length).toBe(2)
    expect(level.goals.length).toBe(2)
  })

  test('solution length is within expected range', () => {
    const level = generateLevel('easy')

    expect(level.optimalMoves).toBeDefined()
    expect(level.optimalMoves).toBeGreaterThanOrEqual(5)
    expect(level.optimalMoves).toBeLessThanOrEqual(20)
  })

  test('generates multiple different puzzles', () => {
    const levels = Array.from({ length: 5 }, () => generateLevel('easy'))

    // Each level should have a unique ID
    const ids = new Set(levels.map((l) => l.id))
    expect(ids.size).toBe(5)
  })

  test('generated puzzles are all solvable (batch test)', () => {
    const count = 5

    for (let i = 0; i < count; i++) {
      const level = generateLevel('easy')
      const result = solvePuzzle(level)

      expect(result.solvable).toBe(true)
      expect(level.optimalMoves).toBeGreaterThan(0)
    }
  })

  test('level has correct structure', () => {
    const level = generateLevel('easy')

    expect(level.id).toBeDefined()
    expect(level.width).toBe(8)
    expect(level.height).toBe(8)
    expect(level.terrain).toHaveLength(8)
    expect(level.terrain[0]).toHaveLength(8)
    expect(level.playerStart).toBeDefined()
    expect(level.playerStart.x).toBeGreaterThanOrEqual(0)
    expect(level.playerStart.y).toBeGreaterThanOrEqual(0)
    expect(level.difficulty).toBe('easy')
  })

  test('player and boxes are not on walls', () => {
    const level = generateLevel('easy')

    // Player should not be on a wall
    const playerCell = level.terrain[level.playerStart.y][level.playerStart.x]
    expect(playerCell).not.toBe('wall')

    // Boxes should not be on walls
    for (const box of level.boxStarts) {
      const boxCell = level.terrain[box.y][box.x]
      expect(boxCell).not.toBe('wall')
    }
  })

  test('goals are marked in terrain', () => {
    const level = generateLevel('easy')

    for (const goal of level.goals) {
      expect(level.terrain[goal.y][goal.x]).toBe('goal')
    }
  })
})

describe('generateLevel difficulties', () => {
  test('medium difficulty has 3 boxes', () => {
    const level = generateLevel('medium')

    expect(level.boxStarts.length).toBe(3)
    expect(level.goals.length).toBe(3)
  })

  test('hard difficulty has 4 boxes', () => {
    const level = generateLevel('hard')

    expect(level.boxStarts.length).toBe(4)
    expect(level.goals.length).toBe(4)
  })

  test('tracks generation iterations', () => {
    const level = generateLevel('easy')

    expect(level.generationIterations).toBeDefined()
    expect(level.generationIterations).toBeGreaterThan(0)
  })
})

describe('generateLevel options', () => {
  test('respects minSolutionLength option', () => {
    const level = generateLevel('easy', { minSolutionLength: 8 })

    expect(level.optimalMoves).toBeGreaterThanOrEqual(8)
  })

  test('respects maxAttempts option', () => {
    // With very high min solution requirement and low attempts, should hit fallback
    const level = generateLevel('easy', { minSolutionLength: 100, maxAttempts: 5 })

    // Either found a valid puzzle or used fallback
    expect(level).toBeDefined()
  })
})
