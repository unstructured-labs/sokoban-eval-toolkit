import type { CellTerrain, Position, WallGeneratorType } from '../types'

export type { WallGeneratorType }

export interface WallGeneratorOptions {
  width: number
  height: number
}

export interface WallGeneratorResult {
  terrain: CellTerrain[][]
}

/**
 * Generate walls using the specified algorithm.
 */
export function generateWalls(
  type: WallGeneratorType,
  options: WallGeneratorOptions,
): WallGeneratorResult {
  switch (type) {
    case 'maze':
      return generateMazeWalls(options)
    case 'rooms':
      return generateRoomWalls(options)
    case 'obstacles':
      return generateObstacleWalls(options)
    default:
      return generateRandomWalls(options)
  }
}

/**
 * Generate random walls (original algorithm).
 */
export function generateRandomWalls(options: WallGeneratorOptions): WallGeneratorResult {
  const { width, height } = options
  const terrain: CellTerrain[][] = []

  // Create terrain with walls on border, floor inside
  for (let y = 0; y < height; y++) {
    const row: CellTerrain[] = []
    for (let x = 0; x < width; x++) {
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        row.push('wall')
      } else {
        row.push('floor')
      }
    }
    terrain.push(row)
  }

  // Add some random internal walls (8% of grid)
  const numWalls = Math.floor(width * height * 0.08)
  for (let i = 0; i < numWalls; i++) {
    const x = randomInt(2, width - 3)
    const y = randomInt(2, height - 3)
    terrain[y][x] = 'wall'
  }

  return { terrain }
}

/**
 * Generate maze-like corridors using recursive backtracking.
 * Creates connected pathways with 2-wide corridors for box pushing.
 */
export function generateMazeWalls(options: WallGeneratorOptions): WallGeneratorResult {
  const { width, height } = options
  const terrain: CellTerrain[][] = []

  // Initialize all as walls
  for (let y = 0; y < height; y++) {
    terrain.push(Array(width).fill('wall') as CellTerrain[])
  }

  // Carve maze using recursive backtracking (2-cell steps for wider corridors)
  const visited = new Set<string>()

  // Start from a random interior position (odd coordinates for proper maze)
  const startX = randomInt(2, Math.floor((width - 3) / 2)) * 2 - 1
  const startY = randomInt(2, Math.floor((height - 3) / 2)) * 2 - 1

  const stack: Position[] = [{ x: startX, y: startY }]
  visited.add(`${startX},${startY}`)
  terrain[startY][startX] = 'floor'

  const directions = [
    { dx: 0, dy: -2 }, // Up
    { dx: 0, dy: 2 }, // Down
    { dx: -2, dy: 0 }, // Left
    { dx: 2, dy: 0 }, // Right
  ]

  while (stack.length > 0) {
    const current = stack[stack.length - 1]

    // Find unvisited neighbors
    const neighbors: { pos: Position; wall: Position }[] = []
    for (const { dx, dy } of directions) {
      const nx = current.x + dx
      const ny = current.y + dy
      const wx = current.x + dx / 2
      const wy = current.y + dy / 2

      if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1) {
        if (!visited.has(`${nx},${ny}`)) {
          neighbors.push({
            pos: { x: nx, y: ny },
            wall: { x: wx, y: wy },
          })
        }
      }
    }

    if (neighbors.length > 0) {
      // Pick random neighbor
      const next = neighbors[randomInt(0, neighbors.length - 1)]

      // Carve path (remove wall between and at destination)
      terrain[next.wall.y][next.wall.x] = 'floor'
      terrain[next.pos.y][next.pos.x] = 'floor'

      visited.add(`${next.pos.x},${next.pos.y}`)
      stack.push(next.pos)
    } else {
      // Backtrack
      stack.pop()
    }
  }

  // Widen corridors by adding floor cells adjacent to existing floors
  widenCorridors(terrain, width, height)

  // Ensure connectivity and add some openings
  addRandomOpenings(terrain, width, height, 0.1)

  return { terrain }
}

/**
 * Generate multi-room layout using BSP (Binary Space Partitioning).
 */
export function generateRoomWalls(options: WallGeneratorOptions): WallGeneratorResult {
  const { width, height } = options
  const terrain: CellTerrain[][] = []

  // Initialize all as walls
  for (let y = 0; y < height; y++) {
    terrain.push(Array(width).fill('wall') as CellTerrain[])
  }

  interface Room {
    x: number
    y: number
    w: number
    h: number
  }

  const MIN_ROOM_SIZE = 4
  const rooms: Room[] = []

  // BSP subdivision
  function subdivide(x: number, y: number, w: number, h: number, depth: number): void {
    // Stop if too small or max depth reached
    if (w < MIN_ROOM_SIZE * 2 || h < MIN_ROOM_SIZE * 2 || depth > 3) {
      // Create room with 1-cell wall margin
      const roomX = x + 1
      const roomY = y + 1
      const roomW = w - 2
      const roomH = h - 2

      if (roomW >= 2 && roomH >= 2) {
        rooms.push({ x: roomX, y: roomY, w: roomW, h: roomH })

        // Carve out the room
        for (let ry = roomY; ry < roomY + roomH; ry++) {
          for (let rx = roomX; rx < roomX + roomW; rx++) {
            if (ry > 0 && ry < height - 1 && rx > 0 && rx < width - 1) {
              terrain[ry][rx] = 'floor'
            }
          }
        }
      }
      return
    }

    // Decide split direction (prefer splitting the longer dimension)
    const splitHorizontal = h > w ? true : w > h ? false : Math.random() > 0.5

    if (splitHorizontal) {
      const splitY = y + randomInt(MIN_ROOM_SIZE, h - MIN_ROOM_SIZE)
      subdivide(x, y, w, splitY - y, depth + 1)
      subdivide(x, splitY, w, h - (splitY - y), depth + 1)
    } else {
      const splitX = x + randomInt(MIN_ROOM_SIZE, w - MIN_ROOM_SIZE)
      subdivide(x, y, splitX - x, h, depth + 1)
      subdivide(splitX, y, w - (splitX - x), h, depth + 1)
    }
  }

  // Start subdivision from interior
  subdivide(1, 1, width - 2, height - 2, 0)

  // Connect rooms with doorways
  for (let i = 0; i < rooms.length - 1; i++) {
    const room1 = rooms[i]
    const room2 = rooms[i + 1]

    // Find center of each room
    const c1 = { x: room1.x + Math.floor(room1.w / 2), y: room1.y + Math.floor(room1.h / 2) }
    const c2 = { x: room2.x + Math.floor(room2.w / 2), y: room2.y + Math.floor(room2.h / 2) }

    // Carve L-shaped corridor between rooms (2-wide for box pushing)
    carveCorridor(terrain, c1, c2, width, height)
  }

  // Ensure all rooms are connected
  ensureConnectivity(terrain, width, height)

  return { terrain }
}

/**
 * Generate strategic obstacle placement.
 * Places walls to create interesting push challenges without blocking paths.
 */
export function generateObstacleWalls(options: WallGeneratorOptions): WallGeneratorResult {
  const { width, height } = options
  const terrain: CellTerrain[][] = []

  // Start with mostly open floor
  for (let y = 0; y < height; y++) {
    const row: CellTerrain[] = []
    for (let x = 0; x < width; x++) {
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        row.push('wall')
      } else {
        row.push('floor')
      }
    }
    terrain.push(row)
  }

  // Add strategic wall patterns

  // 1. Add some L-shaped obstacles
  const numLShapes = randomInt(1, 3)
  for (let i = 0; i < numLShapes; i++) {
    const x = randomInt(2, width - 4)
    const y = randomInt(2, height - 4)
    const rotation = randomInt(0, 3)

    addLShape(terrain, x, y, rotation, width, height)
  }

  // 2. Add some single-cell pillars
  const numPillars = randomInt(2, 4)
  for (let i = 0; i < numPillars; i++) {
    const x = randomInt(2, width - 3)
    const y = randomInt(2, height - 3)

    // Only place if it doesn't block a corridor
    if (countAdjacentFloors(terrain, x, y, width, height) >= 6) {
      terrain[y][x] = 'wall'
    }
  }

  // 3. Add some short wall segments
  const numSegments = randomInt(1, 3)
  for (let i = 0; i < numSegments; i++) {
    const horizontal = Math.random() > 0.5
    const length = randomInt(2, 3)

    if (horizontal) {
      const x = randomInt(2, width - 3 - length)
      const y = randomInt(2, height - 3)

      // Check if it would block too much
      let canPlace = true
      for (let dx = 0; dx < length; dx++) {
        if (countAdjacentFloors(terrain, x + dx, y, width, height) < 4) {
          canPlace = false
          break
        }
      }

      if (canPlace) {
        for (let dx = 0; dx < length; dx++) {
          terrain[y][x + dx] = 'wall'
        }
      }
    } else {
      const x = randomInt(2, width - 3)
      const y = randomInt(2, height - 3 - length)

      let canPlace = true
      for (let dy = 0; dy < length; dy++) {
        if (countAdjacentFloors(terrain, x, y + dy, width, height) < 4) {
          canPlace = false
          break
        }
      }

      if (canPlace) {
        for (let dy = 0; dy < length; dy++) {
          terrain[y + dy][x] = 'wall'
        }
      }
    }
  }

  // Ensure connectivity
  ensureConnectivity(terrain, width, height)

  return { terrain }
}

// ============ Helper Functions ============

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Widen corridors to ensure 2-cell width for box pushing.
 */
function widenCorridors(terrain: CellTerrain[][], width: number, height: number): void {
  const toCarve: Position[] = []

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (terrain[y][x] === 'floor') {
        // Check adjacent cells and widen
        const neighbors = [
          { x: x + 1, y },
          { x: x - 1, y },
          { x, y: y + 1 },
          { x, y: y - 1 },
        ]

        for (const n of neighbors) {
          if (n.x > 0 && n.x < width - 1 && n.y > 0 && n.y < height - 1) {
            if (terrain[n.y][n.x] === 'wall') {
              // Check if widening here creates a 2-wide corridor
              const adjacentFloors = countAdjacentFloors(terrain, n.x, n.y, width, height)
              if (adjacentFloors >= 1 && adjacentFloors <= 3) {
                toCarve.push(n)
              }
            }
          }
        }
      }
    }
  }

  // Apply widening (only some cells to avoid completely open spaces)
  for (const pos of toCarve) {
    if (Math.random() > 0.5) {
      terrain[pos.y][pos.x] = 'floor'
    }
  }
}

/**
 * Add random openings to make maze more interesting.
 */
function addRandomOpenings(
  terrain: CellTerrain[][],
  width: number,
  height: number,
  probability: number,
): void {
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      if (terrain[y][x] === 'wall' && Math.random() < probability) {
        // Only remove if it doesn't create a 2x2 open area
        const adjacentFloors = countAdjacentFloors(terrain, x, y, width, height)
        if (adjacentFloors >= 2 && adjacentFloors <= 5) {
          terrain[y][x] = 'floor'
        }
      }
    }
  }
}

/**
 * Count floor cells adjacent to a position.
 */
function countAdjacentFloors(
  terrain: CellTerrain[][],
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  let count = 0
  const neighbors = [
    { dx: -1, dy: -1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 1 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 1 },
  ]

  for (const { dx, dy } of neighbors) {
    const nx = x + dx
    const ny = y + dy
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      if (terrain[ny][nx] === 'floor' || terrain[ny][nx] === 'goal') {
        count++
      }
    }
  }

  return count
}

/**
 * Carve a 2-wide L-shaped corridor between two points.
 */
function carveCorridor(
  terrain: CellTerrain[][],
  from: Position,
  to: Position,
  width: number,
  height: number,
): void {
  // Carve horizontal then vertical (or vice versa randomly)
  const horizontalFirst = Math.random() > 0.5

  const carveCell = (x: number, y: number) => {
    if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
      terrain[y][x] = 'floor'
      // Widen to 2 cells where possible
      if (x + 1 < width - 1) terrain[y][x + 1] = 'floor'
      if (y + 1 < height - 1) terrain[y + 1][x] = 'floor'
    }
  }

  if (horizontalFirst) {
    // Horizontal first
    const xDir = from.x < to.x ? 1 : -1
    for (let x = from.x; x !== to.x; x += xDir) {
      carveCell(x, from.y)
    }
    // Then vertical
    const yDir = from.y < to.y ? 1 : -1
    for (let y = from.y; y !== to.y + yDir; y += yDir) {
      carveCell(to.x, y)
    }
  } else {
    // Vertical first
    const yDir = from.y < to.y ? 1 : -1
    for (let y = from.y; y !== to.y; y += yDir) {
      carveCell(from.x, y)
    }
    // Then horizontal
    const xDir = from.x < to.x ? 1 : -1
    for (let x = from.x; x !== to.x + xDir; x += xDir) {
      carveCell(x, to.y)
    }
  }
}

/**
 * Add an L-shaped wall obstacle.
 */
function addLShape(
  terrain: CellTerrain[][],
  x: number,
  y: number,
  rotation: number,
  width: number,
  height: number,
): void {
  // L-shape patterns based on rotation
  const patterns = [
    [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
    ],
    [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 1, dy: 1 },
    ],
    [
      { dx: 0, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 },
    ],
    [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
    ],
  ]

  const pattern = patterns[rotation % patterns.length]

  for (const { dx, dy } of pattern) {
    const px = x + dx
    const py = y + dy
    if (px > 0 && px < width - 1 && py > 0 && py < height - 1) {
      terrain[py][px] = 'wall'
    }
  }
}

/**
 * Ensure all floor cells are connected using flood fill.
 * If disconnected regions exist, carve paths to connect them.
 */
function ensureConnectivity(terrain: CellTerrain[][], width: number, height: number): void {
  // Find all floor regions
  const visited = new Set<string>()
  const regions: Position[][] = []

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const key = `${x},${y}`
      if ((terrain[y][x] === 'floor' || terrain[y][x] === 'goal') && !visited.has(key)) {
        // BFS to find connected region
        const region: Position[] = []
        const queue: Position[] = [{ x, y }]

        while (queue.length > 0) {
          const pos = queue.shift()
          if (!pos) continue
          const posKey = `${pos.x},${pos.y}`

          if (visited.has(posKey)) continue
          visited.add(posKey)
          region.push(pos)

          const neighbors = [
            { x: pos.x + 1, y: pos.y },
            { x: pos.x - 1, y: pos.y },
            { x: pos.x, y: pos.y + 1 },
            { x: pos.x, y: pos.y - 1 },
          ]

          for (const n of neighbors) {
            if (n.x > 0 && n.x < width - 1 && n.y > 0 && n.y < height - 1) {
              if (
                (terrain[n.y][n.x] === 'floor' || terrain[n.y][n.x] === 'goal') &&
                !visited.has(`${n.x},${n.y}`)
              ) {
                queue.push(n)
              }
            }
          }
        }

        if (region.length > 0) {
          regions.push(region)
        }
      }
    }
  }

  // Connect all regions to the first (largest) region
  if (regions.length > 1) {
    // Sort by size, keep largest
    regions.sort((a, b) => b.length - a.length)
    const mainRegion = regions[0]

    for (let i = 1; i < regions.length; i++) {
      const otherRegion = regions[i]

      // Find closest points between regions
      let minDist = Number.POSITIVE_INFINITY
      let closest: { from: Position; to: Position } | null = null

      for (const p1 of mainRegion) {
        for (const p2 of otherRegion) {
          const dist = Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y)
          if (dist < minDist) {
            minDist = dist
            closest = { from: p1, to: p2 }
          }
        }
      }

      // Carve path between closest points
      if (closest) {
        carveCorridor(terrain, closest.from, closest.to, width, height)
      }
    }
  }
}

/**
 * Validate that all floor cells are connected.
 */
export function validateConnectivity(terrain: CellTerrain[][]): boolean {
  const height = terrain.length
  const width = terrain[0]?.length ?? 0

  // Find first floor cell
  let startPos: Position | null = null
  let totalFloors = 0

  for (let y = 0; y < height && !startPos; y++) {
    for (let x = 0; x < width; x++) {
      if (terrain[y][x] === 'floor' || terrain[y][x] === 'goal') {
        totalFloors++
        if (!startPos) startPos = { x, y }
      }
    }
  }

  // Count remaining floors after finding start
  for (let y = startPos ? startPos.y : 0; y < height; y++) {
    for (let x = y === startPos?.y ? startPos.x + 1 : 0; x < width; x++) {
      if (terrain[y][x] === 'floor' || terrain[y][x] === 'goal') {
        totalFloors++
      }
    }
  }

  if (!startPos || totalFloors === 0) return true

  // BFS from start
  const visited = new Set<string>()
  const queue: Position[] = [startPos]

  while (queue.length > 0) {
    const pos = queue.shift()
    if (!pos) continue
    const key = `${pos.x},${pos.y}`

    if (visited.has(key)) continue
    visited.add(key)

    const neighbors = [
      { x: pos.x + 1, y: pos.y },
      { x: pos.x - 1, y: pos.y },
      { x: pos.x, y: pos.y + 1 },
      { x: pos.x, y: pos.y - 1 },
    ]

    for (const n of neighbors) {
      if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
        if (
          (terrain[n.y][n.x] === 'floor' || terrain[n.y][n.x] === 'goal') &&
          !visited.has(`${n.x},${n.y}`)
        ) {
          queue.push(n)
        }
      }
    }
  }

  return visited.size === totalFloors
}
