import { describe, expect, test } from 'bun:test'
import { generateEasyLevel } from '../levelGenerator'
import { solvePuzzle } from '../sokobanSolver'

describe('generateEasyLevel', () => {
  test('generates solvable puzzle', () => {
    const level = generateEasyLevel()

    const result = solvePuzzle(level)

    expect(result.solvable).toBe(true)
    expect(result.solution).not.toBeNull()
  })

  test('generates puzzle with 2 boxes by default', () => {
    const level = generateEasyLevel()

    expect(level.boxStarts.length).toBe(2)
    expect(level.goals.length).toBe(2)
  })

  test('generates puzzle with custom number of boxes', () => {
    const level = generateEasyLevel({ numBoxes: 3 })

    expect(level.boxStarts.length).toBe(3)
    expect(level.goals.length).toBe(3)
  })

  test('solution length is between 5-15 moves', () => {
    const level = generateEasyLevel()

    expect(level.optimalMoves).toBeDefined()
    expect(level.optimalMoves).toBeGreaterThanOrEqual(5)
    expect(level.optimalMoves).toBeLessThanOrEqual(15)
  })

  test('generates multiple different puzzles', () => {
    const levels = Array.from({ length: 5 }, () => generateEasyLevel())

    // Each level should have a unique ID
    const ids = new Set(levels.map((l) => l.id))
    expect(ids.size).toBe(5)
  })

  test('generated puzzles are all solvable (batch test)', () => {
    const count = 10

    for (let i = 0; i < count; i++) {
      const level = generateEasyLevel()
      const result = solvePuzzle(level)

      expect(result.solvable).toBe(true)
      expect(level.optimalMoves).toBeGreaterThan(0)
    }
  })

  test('respects custom solution length bounds', () => {
    const level = generateEasyLevel({
      minSolutionLength: 8,
      maxSolutionLength: 12,
    })

    expect(level.optimalMoves).toBeDefined()
    expect(level.optimalMoves).toBeGreaterThanOrEqual(8)
    expect(level.optimalMoves).toBeLessThanOrEqual(12)
  })

  test('level has correct structure', () => {
    const level = generateEasyLevel()

    expect(level.id).toBeDefined()
    expect(level.width).toBe(8)
    expect(level.height).toBe(8)
    expect(level.terrain).toHaveLength(8)
    expect(level.terrain[0]).toHaveLength(8)
    expect(level.playerStart).toBeDefined()
    expect(level.playerStart.x).toBeGreaterThanOrEqual(0)
    expect(level.playerStart.y).toBeGreaterThanOrEqual(0)
    expect(level.difficulty).toBe('easy')
    expect(level.fileSource).toBe('generated')
  })

  test('player and boxes are not on walls', () => {
    const level = generateEasyLevel()

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
    const level = generateEasyLevel()

    for (const goal of level.goals) {
      expect(level.terrain[goal.y][goal.x]).toBe('goal')
    }
  })
})
