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

// Difficulty levels
export type Difficulty = 'lmiq-reasoning-easy' | 'classic' | 'classic-hard' | 'microban'

// Movement directions
export type MoveDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

// Saved layout from UI export
export interface SavedLayout {
  id: string
  name: string
  savedAt: number
  order?: number
  difficulty: Difficulty
  width: number
  height: number
  terrain: CellTerrain[][]
  playerStart: Position
  boxStarts: Box[]
  goals: Position[]
}

// Export format from UI
export interface ExportedPuzzles {
  exportedAt: number
  version: 1
  puzzles: SavedLayout[]
}

// Game level format (compatible with game engine)
export interface SokobanLevel {
  id: string
  width: number
  height: number
  terrain: CellTerrain[][]
  playerStart: Position
  boxStarts: Box[]
  goals: Position[]
  difficulty: Difficulty
  fileSource: string
  puzzleNumber: number
}

// Move record for tracking history
export interface MoveRecord {
  id: string
  direction: MoveDirection
  wasPush: boolean
  previousPlayerPos: Position
  previousBox?: Box
  source: 'human' | 'ai'
  timestamp: number
}

// Game state during execution
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

// Prompt options for LLM
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

// LLM response structure
export interface LLMResponse {
  moves: MoveDirection[]
  rawResponse: string
  nativeReasoning?: string
  parsedReasoning?: string
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  cost: number
  durationMs: number
  error?: string
}

// Evaluation options
export interface EvalOptions {
  concurrency: number
}

// Result for one puzzle + one model combination
export interface EvalResult {
  puzzleId: string
  puzzleName: string
  modelId: string
  modelName: string

  // Outcome
  solved: boolean
  error: string | null

  // Timing
  inferenceTimeMs: number

  // Moves
  moves: MoveDirection[] // Parsed moves from LLM response
  solutionLength: number // Number of moves in LLM response
  stepsExecuted: number // Valid moves executed before failure/success

  // Token metrics
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  totalTokens: number
  cost: number

  // Derived estimates
  wordsEstimate: number // outputTokens * 0.75
  pagesEstimate: number // wordsEstimate / 500

  // Raw response for debugging
  rawResponse: string
}

// Summary statistics for a model
export interface ModelSummary {
  modelId: string
  modelName: string
  puzzlesSolved: number
  puzzlesTotal: number
  avgSolveSteps: number | null
  avgInferenceTimeMs: number
  totalOutputTokens: number
  totalCost: number
}

// Full evaluation run
export interface EvalRun {
  id: string
  startedAt: number
  completedAt: number | null
  puzzleFile: string
  puzzleCount: number
  models: string[]
  options: EvalOptions
  results: EvalResult[]
  summary: {
    byModel: Record<string, ModelSummary>
  }
  status: 'running' | 'completed' | 'failed'
  error?: string
}

// Progress callback for UI updates
export interface EvalProgress {
  currentPuzzle: number
  totalPuzzles: number
  currentModel: string
  puzzleName: string
  status: 'running' | 'success' | 'failed'
  result?: EvalResult
}
