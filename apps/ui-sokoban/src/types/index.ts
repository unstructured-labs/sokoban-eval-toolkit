// Core position type
export interface Position {
  x: number // column (0-indexed)
  y: number // row (0-indexed)
}

// Box colors for visual distinction
export type BoxColor = 'orange' | 'purple' | 'emerald' | 'sky'

// Box with position and color
export interface Box {
  x: number
  y: number
  color: BoxColor
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
  boxStarts: Box[]
  goals: Position[]
  difficulty: Difficulty
  fileSource: string
  puzzleNumber: number
  optimalMoves?: number // Minimum moves to solve (from solver)
  generationIterations?: number // Number of attempts to generate this puzzle
  usedFallback?: boolean // True if generator fell back to simple puzzle
}

export type Difficulty = 'lmiq-reasoning-easy' | 'classic' | 'classic-hard' | 'microban'

// Movement
export type MoveDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

export interface MoveRecord {
  id: string
  direction: MoveDirection
  wasPush: boolean
  previousPlayerPos: Position
  previousBox?: Box // only if was a push
  source: 'human' | 'ai'
  timestamp: number
}

// Current game state (mutable during play)
export interface GameState {
  level: SokobanLevel
  playerPos: Position
  boxes: Box[]
  moveHistory: MoveRecord[]
  isWon: boolean
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
  newBox?: Box
  pushedBoxIndex?: number
  error?: string
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

// Human player session tracking
export interface HumanSession {
  isActive: boolean
  startTime: number
  endTime?: number // Set when session ends
  totalSteps: number // Cumulative steps across all attempts
  stepsAtLastReset: number // Steps accumulated before current attempt
  restarts: number // Number of times reset during session
  levelId: string
}

// AI prompt options
export interface PromptOptions {
  asciiGrid: boolean
  coordinateFormat: boolean
  includeNotationGuide: boolean
  executionMode: 'fullSolution' | 'moveByMove'
  coordinateLocations: boolean
  coloredBoxRules: boolean
  specialInstructions?: string
  includeSpecialInstructions?: boolean
}

// AI session metrics
export interface SessionMetrics {
  totalCost: number
  totalTokens: number
  totalInputTokens: number
  totalOutputTokens: number
  totalReasoningTokens: number
  estimatedWords: number
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
