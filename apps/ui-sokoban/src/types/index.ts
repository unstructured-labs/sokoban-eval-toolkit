// Core position type
export interface Position {
  x: number // column (0-indexed)
  y: number // row (0-indexed)
}

// What's in a cell (static terrain)
export type CellTerrain = 'floor' | 'wall' | 'goal'

// Parsed level from boxoban format
export interface SokobanLevel {
  id: string
  width: number
  height: number
  terrain: CellTerrain[][] // [row][col] - static terrain only
  playerStart: Position
  boxStarts: Position[]
  goals: Position[]
  playerGoal?: Position // Optional goal location the player must reach
  difficulty: Difficulty
  fileSource: string
  puzzleNumber: number
  optimalMoves?: number // Minimum moves to solve (from solver)
  generationIterations?: number // Number of attempts to generate this puzzle
  usedFallback?: boolean // True if generator fell back to simple puzzle
}

export type Difficulty =
  | 'easy'
  | 'easy-custom'
  | 'medium'
  | 'hard'
  | 'classic'
  | 'classic-hard'
  | 'microban'

// Movement
export type MoveDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

export interface MoveRecord {
  id: string
  direction: MoveDirection
  wasPush: boolean
  previousPlayerPos: Position
  previousBoxPos?: Position // only if was a push (single box)
  previousBoxPositions?: Position[] // for multi-box push (custom pushing rules)
  neutralizedTrap?: Position // if a box was pushed onto a trap (for variant rules undo)
  source: 'human' | 'ai'
  timestamp: number
}

// Current game state (mutable during play)
export interface GameState {
  level: SokobanLevel
  playerPos: Position
  boxes: Position[]
  moveHistory: MoveRecord[]
  isWon: boolean
  isLost: boolean // For variant rules: player stepped on a trap
  neutralizedTraps: Position[] // Traps that have been neutralized by pushing boxes onto them
  moveCount: number
  pushCount: number
  startTime: number | null
  endTime: number | null
}

// Move validation result
export interface MoveValidationResult {
  valid: boolean
  isPush: boolean
  newPlayerPos: Position
  newBoxPos?: Position
  pushedBoxIndex?: number
  neutralizesTrap?: boolean // For variant rules: box was pushed onto a trap
  error?: string
  // For custom pushing rules: multiple boxes pushed in sequence
  pushedBoxIndices?: number[]
  newBoxPositions?: Position[]
}

// Solution validation result
export interface SolutionValidationResult {
  valid: boolean
  solved: boolean
  movesExecuted: number
  invalidMoveIndex?: number
  finalState?: GameState
  error?: string
}

// AI prompt options
export interface PromptOptions {
  asciiGrid: boolean
  coordinateFormat: boolean
  includeNotationGuide: boolean
  executionMode: 'fullSolution' | 'moveByMove'
  cipherSymbols: boolean
  coordinateLocations: boolean
  variantRules: boolean // Goals become traps, player must reach player goal
  customPushingRules: boolean // Allow pushing multiple boxes in a row
}

// AI session metrics
export interface SessionMetrics {
  totalCost: number
  totalTokens: number
  totalDurationMs: number
  requestCount: number
}

// Planned move for AI execution
export interface PlannedMove {
  id: string
  direction: MoveDirection
  status: 'pending' | 'executing' | 'success' | 'failed' | 'invalid'
  error?: string
}
