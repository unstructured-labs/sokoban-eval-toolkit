import type { CellTerrain, Position } from '../types'

/**
 * Generate a random integer between min and max (inclusive).
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Shuffle an array using Fisher-Yates algorithm.
 * Returns a new array without modifying the original.
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Direction vectors for grid traversal.
 */
export const DIRECTIONS = [
  { dx: 0, dy: -1 }, // up
  { dx: 0, dy: 1 }, // down
  { dx: -1, dy: 0 }, // left
  { dx: 1, dy: 0 }, // right
] as const

/**
 * Check if all non-wall cells are connected using BFS flood fill.
 * Returns true if all floor/goal cells are reachable from each other.
 */
export function isConnected(terrain: CellTerrain[][], width: number, height: number): boolean {
  // Find first non-wall cell
  let startX = -1
  let startY = -1
  let totalFloors = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (terrain[y]?.[x] !== 'wall') {
        totalFloors++
        if (startX === -1) {
          startX = x
          startY = y
        }
      }
    }
  }

  if (startX === -1) return false

  // BFS to count reachable cells
  const visited = new Set<string>()
  const queue: [number, number][] = [[startX, startY]]
  visited.add(`${startX},${startY}`)

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break
    const [x, y] = current

    for (const { dx, dy } of DIRECTIONS) {
      const nx = x + dx
      const ny = y + dy
      const key = `${nx},${ny}`

      if (
        nx >= 0 &&
        nx < width &&
        ny >= 0 &&
        ny < height &&
        terrain[ny]?.[nx] !== 'wall' &&
        !visited.has(key)
      ) {
        visited.add(key)
        queue.push([nx, ny])
      }
    }
  }

  return visited.size === totalFloors
}

/**
 * Get all positions reachable by player using BFS flood fill.
 * Takes into account box positions as obstacles.
 */
export function getReachablePositions(
  grid: string[][],
  player: Position,
  boxes: Position[],
): Set<string> {
  const visited = new Set<string>([`${player.x},${player.y}`])
  const queue: Position[] = [player]

  while (queue.length > 0) {
    const curr = queue.shift()
    if (!curr) break

    for (const { dx, dy } of DIRECTIONS) {
      const nx = curr.x + dx
      const ny = curr.y + dy
      const key = `${nx},${ny}`

      const cell = grid[ny]?.[nx]
      if (
        (cell === ' ' || cell === '.') &&
        !boxes.some((b) => b.x === nx && b.y === ny) &&
        !visited.has(key)
      ) {
        visited.add(key)
        queue.push({ x: nx, y: ny })
      }
    }
  }

  return visited
}

/**
 * Count adjacent floor/goal cells for a position.
 */
export function countAdjacentFloors(terrain: CellTerrain[][], x: number, y: number): number {
  let count = 0
  for (const { dx, dy } of DIRECTIONS) {
    const cell = terrain[y + dy]?.[x + dx]
    if (cell === 'floor' || cell === 'goal') count++
  }
  return count
}

/**
 * Check if a cell is a floor or goal (passable terrain).
 */
export function isPassable(terrain: CellTerrain[][], x: number, y: number): boolean {
  const cell = terrain[y]?.[x]
  return cell === 'floor' || cell === 'goal'
}

/**
 * Check if a box at position can be pushed (has opposing passable cells).
 */
export function canBePushed(terrain: CellTerrain[][], pos: Position): boolean {
  const canPushHorizontal =
    isPassable(terrain, pos.x - 1, pos.y) && isPassable(terrain, pos.x + 1, pos.y)
  const canPushVertical =
    isPassable(terrain, pos.x, pos.y - 1) && isPassable(terrain, pos.x, pos.y + 1)
  return canPushHorizontal || canPushVertical
}

/**
 * Find all floor positions in a string grid.
 */
export function findFloorPositions(grid: string[][]): Position[] {
  const floors: Position[] = []
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < (grid[0]?.length ?? 0); x++) {
      if (grid[y]?.[x] === ' ' || grid[y]?.[x] === '.') {
        floors.push({ x, y })
      }
    }
  }
  return floors
}

/**
 * Create a position key string for use in Sets/Maps.
 */
export function posKey(x: number, y: number): string {
  return `${x},${y}`
}

/**
 * Create a position key from a Position object.
 */
export function positionKey(pos: Position): string {
  return `${pos.x},${pos.y}`
}
