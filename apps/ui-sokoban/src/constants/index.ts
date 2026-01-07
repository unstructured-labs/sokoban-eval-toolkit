import type { Difficulty } from '@src/types'

// Grid rendering
export const CELL_SIZE = 40

// Colors
export const COLORS = {
  wall: '#1a1a2e',
  floor: '#16213e',
  goal: '#e94560',
  goalCompleted: '#4ade80',
  player: '#0f3460',
  playerBorder: '#00d9ff',
  box: '#f97316',
  boxOnGoal: '#22c55e',
  boxBorder: '#fbbf24',
} as const

// Box colors by type
export const BOX_COLORS: Record<
  import('@src/types').BoxColor,
  { bg: string; bgOnGoal: string; border: string }
> = {
  orange: { bg: '#f97316', bgOnGoal: '#22c55e', border: '#fbbf24' },
  purple: { bg: '#a855f7', bgOnGoal: '#22c55e', border: '#c084fc' },
  emerald: { bg: '#10b981', bgOnGoal: '#22c55e', border: '#34d399' },
  sky: { bg: '#0ea5e9', bgOnGoal: '#22c55e', border: '#38bdf8' },
} as const

// Difficulty display names
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  'lmiq-reasoning-easy': 'LMIQ Reasoning Easy',
  microban: 'Microban (Beginner)',
  classic: 'Boxoban (Medium)',
  'classic-hard': 'Boxoban (Hard)',
}

// Move key mappings (arrow keys only)
export const MOVE_KEYS: Record<string, import('@src/types').MoveDirection> = {
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
}

// Direction vectors
export const DIRECTION_VECTORS: Record<
  import('@src/types').MoveDirection,
  { dx: number; dy: number }
> = {
  UP: { dx: 0, dy: -1 },
  DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 },
  RIGHT: { dx: 1, dy: 0 },
}

// Sokoban notation mapping
export const SOKOBAN_NOTATION: Record<string, import('@src/types').MoveDirection> = {
  u: 'UP',
  U: 'UP',
  d: 'DOWN',
  D: 'DOWN',
  l: 'LEFT',
  L: 'LEFT',
  r: 'RIGHT',
  R: 'RIGHT',
}

// AI move execution delay (ms)
export const AI_MOVE_DELAY = 200
