import type { CellTerrain, Position } from '../types'

// ------------------------------------------------------------------
// Configuration
// ------------------------------------------------------------------

export interface WallGeneratorOptions {
  width: number
  height: number
  /** How many smoothing iterations to run. 4-5 is usually the sweet spot. */
  iterations?: number
  /** The initial percentage of walls. 0.45 - 0.48 is best for distinct caves. */
  fillPercent?: number
}

export interface WallGeneratorResult {
  terrain: CellTerrain[][]
}

/**
 * Generates an organic, cave-like layout using Cellular Automata.
 * This creates natural-looking "rooms" and "corridors" rather than
 * artificial squares.
 */
export function generateOrganicWalls(options: WallGeneratorOptions): WallGeneratorResult {
  const width = options.width
  const height = options.height
  const fillPercent = options.fillPercent ?? 0.46 // 46% wall density is a magic number for CA
  const iterations = options.iterations ?? 4

  // 1. Initialize map with random noise
  let map: CellTerrain[][] = []

  for (let y = 0; y < height; y++) {
    const row: CellTerrain[] = []
    for (let x = 0; x < width; x++) {
      // Force borders to be walls
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        row.push('wall')
      } else {
        // Randomly fill the middle
        row.push(Math.random() < fillPercent ? 'wall' : 'floor')
      }
    }
    map.push(row)
  }

  // 2. Apply Cellular Automata smoothing
  for (let i = 0; i < iterations; i++) {
    map = applySmoothingStep(map, width, height)
  }

  // 3. Post-Process: Keep only the largest cavern
  // This ensures the map is playable and connected.
  map = pruneSmallCaverns(map, width, height)

  return { terrain: map }
}

/**
 * The "Selector" - Brute force generation.
 * Generates maps until one meets specific "interesting" criteria.
 */
export function generateInterestingLevel(
  options: WallGeneratorOptions,
  maxAttempts = 5000,
): WallGeneratorResult {
  let bestResult: WallGeneratorResult | null = null
  let bestScore = Number.NEGATIVE_INFINITY

  for (let i = 0; i < maxAttempts; i++) {
    const result = generateOrganicWalls(options)
    const stats = analyzeTerrain(result.terrain)

    // Heuristics for a "Good" Sokoban/Game Map:

    // 1. Not too empty, not too full (30% - 50% floor space)
    const validDensity = stats.floorPercent > 0.3 && stats.floorPercent < 0.5

    // 2. Ensure it's not just a giant empty box.
    // We check "edge density" - we want a ragged coastline, not a square.
    const isJaggedEnough = stats.wallNeighborsPerFloor > 1.5

    if (validDensity && isJaggedEnough) {
      console.log(
        `[WallGen] Found good terrain on attempt ${i + 1}: ${(stats.floorPercent * 100).toFixed(1)}% floor, ${stats.wallNeighborsPerFloor.toFixed(2)} wall neighbors/floor`,
      )
      return result
    }

    // Track best result as fallback
    const score = (validDensity ? 1 : 0) + (isJaggedEnough ? 1 : 0) + stats.floorPercent
    if (score > bestScore) {
      bestScore = score
      bestResult = result
    }
  }

  console.log(`[WallGen] Using best fallback after ${maxAttempts} attempts`)
  // bestResult will always be set after at least one iteration
  return bestResult as WallGeneratorResult
}

// ------------------------------------------------------------------
// Internal Logic
// ------------------------------------------------------------------

function applySmoothingStep(
  oldMap: CellTerrain[][],
  width: number,
  height: number,
): CellTerrain[][] {
  const newMap: CellTerrain[][] = oldMap.map((row) => [...row]) // Shallow copy each row

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const neighborWalls = countWallNeighbors(oldMap, x, y)

      // The "4-5 Rule":
      // If a cell has more than 4 wall neighbors, it becomes a wall.
      // If it has fewer, it becomes a floor.
      if (neighborWalls > 4) {
        newMap[y][x] = 'wall'
      } else if (neighborWalls < 4) {
        newMap[y][x] = 'floor'
      }
      // If exactly 4, stays the same state (stability)
    }
  }
  return newMap
}

function countWallNeighbors(map: CellTerrain[][], gridX: number, gridY: number): number {
  let count = 0
  for (let y = gridY - 1; y <= gridY + 1; y++) {
    for (let x = gridX - 1; x <= gridX + 1; x++) {
      if (y >= 0 && x >= 0 && y < map.length && x < map[0].length) {
        if (y !== gridY || x !== gridX) {
          // Don't count self
          if (map[y][x] === 'wall') {
            count++
          }
        }
      } else {
        // Off-map counts as wall (encourages walls at edges)
        count++
      }
    }
  }
  return count
}

/**
 * Identifies the largest connected region of floor and fills all other regions with walls.
 */
function pruneSmallCaverns(map: CellTerrain[][], width: number, height: number): CellTerrain[][] {
  const visited = new Set<string>()
  const regions: Position[][] = []

  // Flood fill to find all unconnected floor regions
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (map[y][x] === 'floor' && !visited.has(`${x},${y}`)) {
        const region: Position[] = []
        const queue: Position[] = [{ x, y }]
        visited.add(`${x},${y}`)

        while (queue.length > 0) {
          const curr = queue.pop()
          if (!curr) continue
          region.push(curr)

          const dirs = [
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0],
          ]
          for (const [dx, dy] of dirs) {
            const nx = curr.x + dx
            const ny = curr.y + dy
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              if (map[ny][nx] === 'floor' && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`)
                queue.push({ x: nx, y: ny })
              }
            }
          }
        }
        regions.push(region)
      }
    }
  }

  if (regions.length === 0) return map

  // Sort regions by size (largest first)
  regions.sort((a, b) => b.length - a.length)

  // Keep regions[0], fill all others
  const finalMap: CellTerrain[][] = map.map((row) => [...row])

  // Fill all smaller regions
  for (let i = 1; i < regions.length; i++) {
    for (const pos of regions[i]) {
      finalMap[pos.y][pos.x] = 'wall'
    }
  }

  return finalMap
}

function analyzeTerrain(map: CellTerrain[][]) {
  let floorCount = 0
  let totalWallNeighborsForFloors = 0
  const height = map.length
  const width = map[0].length

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (map[y][x] === 'floor') {
        floorCount++
        totalWallNeighborsForFloors += countWallNeighbors(map, x, y)
      }
    }
  }

  const totalCells = (width - 2) * (height - 2)

  return {
    floorPercent: floorCount / totalCells,
    // Higher number = more "cramped" or "corridor-like".
    // Lower number = more "open room".
    wallNeighborsPerFloor: floorCount > 0 ? totalWallNeighborsForFloors / floorCount : 0,
  }
}

// ------------------------------------------------------------------
// Accretion-Based Generator (Overlapping Stamps)
// ------------------------------------------------------------------

/**
 * Generates terrain by carving corridors that branch at right angles.
 * This creates L-shapes, T-shapes, and U-shapes naturally.
 *
 * Key improvements for small grids:
 * - Starts from a random edge (not center) for asymmetry
 * - Uses thin corridors (width 2) that branch
 * - Forces turns to create interesting shapes
 */
export function generateAccretionWalls(options: WallGeneratorOptions): WallGeneratorResult {
  const { width, height } = options

  // 1. Start with a solid block of walls
  const terrain: CellTerrain[][] = Array(height)
    .fill(null)
    .map(() => Array(width).fill('wall') as CellTerrain[])

  // For small grids, target less floor space to leave interesting shapes
  const isSmallGrid = width <= 10 || height <= 10
  const targetFloorRatio = isSmallGrid ? 0.32 : 0.42
  const totalArea = (width - 2) * (height - 2)
  let currentFloorCount = 0

  // Track carved positions
  const floorTiles: Position[] = []

  // 2. Pick a random starting edge position (not center!)
  const edge = randomInt(0, 3) // 0=top, 1=right, 2=bottom, 3=left
  let startX: number
  let startY: number

  switch (edge) {
    case 0: // top
      startX = randomInt(2, width - 4)
      startY = 1
      break
    case 1: // right
      startX = width - 3
      startY = randomInt(2, height - 4)
      break
    case 2: // bottom
      startX = randomInt(2, width - 4)
      startY = height - 3
      break
    default: // left
      startX = 1
      startY = randomInt(2, height - 4)
      break
  }

  // Carve initial small room (2x2)
  carveRoom(startX, startY, 2, 2)

  // 3. Grow by adding corridors that branch
  const directions = [
    { dx: 0, dy: -1 }, // up
    { dx: 1, dy: 0 }, // right
    { dx: 0, dy: 1 }, // down
    { dx: -1, dy: 0 }, // left
  ]

  let attempts = 0
  const maxAttempts = 500

  while (currentFloorCount / totalArea < targetFloorRatio && attempts < maxAttempts) {
    attempts++

    // Pick a random floor tile on the edge (has at least one wall neighbor)
    const edgeTiles = floorTiles.filter((p) => {
      return directions.some((d) => {
        const nx = p.x + d.dx
        const ny = p.y + d.dy
        return nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1 && terrain[ny][nx] === 'wall'
      })
    })

    if (edgeTiles.length === 0) break

    const anchor = edgeTiles[randomInt(0, edgeTiles.length - 1)]

    // Find valid directions to grow
    const validDirs = directions.filter((d) => {
      const nx = anchor.x + d.dx
      const ny = anchor.y + d.dy
      return nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1 && terrain[ny][nx] === 'wall'
    })

    if (validDirs.length === 0) continue

    const dir = validDirs[randomInt(0, validDirs.length - 1)]

    // Carve a corridor in this direction (length 2-4 for small grids, 2-5 for larger)
    const maxLen = isSmallGrid ? 3 : 5
    const corridorLen = randomInt(2, maxLen)

    // Sometimes make it 2 tiles wide for variety
    const corridorWidth = Math.random() < 0.3 ? 2 : 1

    for (let i = 0; i < corridorLen; i++) {
      const nx = anchor.x + dir.dx * (i + 1)
      const ny = anchor.y + dir.dy * (i + 1)

      // Check bounds
      if (nx <= 0 || nx >= width - 1 || ny <= 0 || ny >= height - 1) break

      // Carve main corridor
      if (terrain[ny][nx] === 'wall') {
        terrain[ny][nx] = 'floor'
        currentFloorCount++
        floorTiles.push({ x: nx, y: ny })
      }

      // Carve width (perpendicular)
      if (corridorWidth === 2) {
        const perpDx = dir.dy // perpendicular
        const perpDy = dir.dx
        const wx = nx + perpDx
        const wy = ny + perpDy
        if (wx > 0 && wx < width - 1 && wy > 0 && wy < height - 1) {
          if (terrain[wy][wx] === 'wall') {
            terrain[wy][wx] = 'floor'
            currentFloorCount++
            floorTiles.push({ x: wx, y: wy })
          }
        }
      }
    }
  }

  return { terrain }

  function carveRoom(x: number, y: number, w: number, h: number) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const px = x + dx
        const py = y + dy
        if (px > 0 && px < width - 1 && py > 0 && py < height - 1) {
          if (terrain[py][px] === 'wall') {
            terrain[py][px] = 'floor'
            currentFloorCount++
            floorTiles.push({ x: px, y: py })
          }
        }
      }
    }
  }
}

/**
 * Count corners in the terrain. Corners are floor tiles with exactly
 * two perpendicular wall neighbors.
 *
 * A simple rectangle has 4 corners.
 * An L-shape has 6 corners.
 * A T-shape has 8 corners.
 *
 * More corners = more interesting puzzle shapes.
 */
export function countCorners(terrain: CellTerrain[][]): number {
  let corners = 0
  const h = terrain.length
  const w = terrain[0].length

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (terrain[y][x] === 'floor') {
        const n = terrain[y - 1][x] === 'wall'
        const s = terrain[y + 1][x] === 'wall'
        const e = terrain[y][x + 1] === 'wall'
        const west = terrain[y][x - 1] === 'wall'

        // A corner is formed by two perpendicular walls
        if ((n && e) || (n && west) || (s && e) || (s && west)) {
          corners++
        }
      }
    }
  }
  return corners
}

/**
 * Generates levels using accretion and filters for interesting shapes
 * using the corner heuristic.
 *
 * @param minCorners Minimum corners required (6+ avoids simple rectangles)
 */
export function generateInterestingAccretionLevel(
  options: WallGeneratorOptions,
  maxAttempts = 1000,
  minCorners = 6,
): WallGeneratorResult {
  let bestResult: WallGeneratorResult | null = null
  let bestCorners = 0

  for (let i = 0; i < maxAttempts; i++) {
    const result = generateAccretionWalls(options)
    const corners = countCorners(result.terrain)

    if (corners >= minCorners) {
      console.log(
        `[WallGen] Found interesting accretion level on attempt ${i + 1}: ${corners} corners`,
      )
      return result
    }

    // Track best result as fallback
    if (corners > bestCorners) {
      bestCorners = corners
      bestResult = result
    }
  }

  console.log(
    `[WallGen] Using best fallback after ${maxAttempts} attempts (${bestCorners} corners)`,
  )
  return bestResult as WallGeneratorResult
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
