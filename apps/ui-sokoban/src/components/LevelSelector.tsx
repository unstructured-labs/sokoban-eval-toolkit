import { Button } from '@sokoban-eval-toolkit/ui-library/components/button'
import { Input } from '@sokoban-eval-toolkit/ui-library/components/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sokoban-eval-toolkit/ui-library/components/select'
import { Separator } from '@sokoban-eval-toolkit/ui-library/components/separator'
import { DIFFICULTY_LABELS } from '@src/constants'
import type { Difficulty, SokobanLevel } from '@src/types'
import {
  getHardLevel,
  getHardLevelCount,
  getLmiqLevel,
  getLmiqLevelCount,
  getMediumLevel,
  getMediumLevelCount,
  getMicrobanLevel,
  getMicrobanLevelCount,
  getRandomHardLevel,
  getRandomLmiqLevel,
  getRandomMediumLevel,
  getRandomMicrobanLevel,
} from '@src/utils/levelLoader'
import { ChevronLeft, ChevronRight, Grid3X3, Play, Shuffle } from 'lucide-react'
import { useCallback, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'

// Difficulties that use curated level sets
const CURATED_DIFFICULTIES: Difficulty[] = [
  'lmiq-reasoning-easy',
  'classic',
  'classic-hard',
  'microban',
]

// Info text for each difficulty
const DIFFICULTY_INFO: Record<Difficulty, string> = {
  'lmiq-reasoning-easy': 'LM IQ benchmark puzzles. 1-4 boxes, 4-10 grid (100 levels).',
  microban: 'Classic beginner puzzles by David Skinner (155 levels).',
  classic: 'Medium difficulty puzzles from boxoban-levels (10×10, 4 boxes).',
  'classic-hard': 'Hard difficulty puzzles from boxoban-levels (10×10, 4 boxes).',
}

interface SolutionResult {
  found: boolean
  solution?: string[]
  moveCount?: number
  hitLimit?: boolean
}

interface LevelSelectorProps {
  onLevelLoad: (level: SokobanLevel) => void
  disabled?: boolean
  onEditingChange?: (editing: boolean) => void
  // Solution props
  solution?: SolutionResult | null
  isSolving?: boolean
  onComputeSolution?: () => void
  onRunSolution?: () => void
  canRunSolution?: boolean
}

export function LevelSelector({
  onLevelLoad,
  disabled = false,
  onEditingChange,
  solution,
  isSolving = false,
  onComputeSolution,
  onRunSolution,
  canRunSolution = false,
}: LevelSelectorProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('lmiq-reasoning-easy')
  const [puzzleNumber, setPuzzleNumber] = useState<number>(1)
  const [error, setError] = useState<string | null>(null)
  const [gridWidth, setGridWidth] = useState<number>(8)
  const [gridHeight, setGridHeight] = useState<number>(8)

  const isCurated = CURATED_DIFFICULTIES.includes(difficulty)

  // Get level count for curated difficulties
  const curatedLevelCount =
    difficulty === 'lmiq-reasoning-easy'
      ? getLmiqLevelCount()
      : difficulty === 'microban'
        ? getMicrobanLevelCount()
        : difficulty === 'classic'
          ? getMediumLevelCount()
          : difficulty === 'classic-hard'
            ? getHardLevelCount()
            : 0

  // Helper to get level based on current difficulty
  const getCuratedLevel = useCallback(
    (index: number) => {
      if (difficulty === 'lmiq-reasoning-easy') {
        return getLmiqLevel(index)
      }
      if (difficulty === 'microban') {
        return getMicrobanLevel(index)
      }
      if (difficulty === 'classic-hard') {
        return getHardLevel(index)
      }
      return getMediumLevel(index)
    },
    [difficulty],
  )

  const getRandomCuratedLevel = useCallback(() => {
    if (difficulty === 'lmiq-reasoning-easy') {
      return getRandomLmiqLevel()
    }
    if (difficulty === 'microban') {
      return getRandomMicrobanLevel()
    }
    if (difficulty === 'classic-hard') {
      return getRandomHardLevel()
    }
    return getRandomMediumLevel()
  }, [difficulty])

  const handleLoadCurated = useCallback(() => {
    setError(null)
    const level = getCuratedLevel(puzzleNumber - 1)
    if (level) {
      onLevelLoad(level)
    } else {
      setError(`Puzzle #${puzzleNumber} not found`)
    }
  }, [puzzleNumber, onLevelLoad, getCuratedLevel])

  const handleRandomCurated = useCallback(() => {
    setError(null)
    const level = getRandomCuratedLevel()
    setPuzzleNumber(level.puzzleNumber)
    onLevelLoad(level)
  }, [onLevelLoad, getRandomCuratedLevel])

  const handlePrevCurated = useCallback(() => {
    if (puzzleNumber <= 1) return
    setError(null)
    const newNumber = puzzleNumber - 1
    setPuzzleNumber(newNumber)
    const level = getCuratedLevel(newNumber - 1)
    if (level) {
      onLevelLoad(level)
    }
  }, [puzzleNumber, onLevelLoad, getCuratedLevel])

  const handleNextCurated = useCallback(() => {
    if (puzzleNumber >= curatedLevelCount) return
    setError(null)
    const newNumber = puzzleNumber + 1
    setPuzzleNumber(newNumber)
    const level = getCuratedLevel(newNumber - 1)
    if (level) {
      onLevelLoad(level)
    }
  }, [puzzleNumber, curatedLevelCount, onLevelLoad, getCuratedLevel])

  const handleCreateBlankGrid = useCallback(() => {
    const width = Math.max(4, Math.min(20, gridWidth))
    const height = Math.max(4, Math.min(20, gridHeight))

    // Create terrain with wall borders and floor inside
    const terrain: ('wall' | 'floor' | 'goal')[][] = []
    for (let y = 0; y < height; y++) {
      const row: ('wall' | 'floor' | 'goal')[] = []
      for (let x = 0; x < width; x++) {
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          row.push('wall')
        } else {
          row.push('floor')
        }
      }
      terrain.push(row)
    }

    // Place player in center
    const playerStart = {
      x: Math.floor(width / 2),
      y: Math.floor(height / 2),
    }

    const level: SokobanLevel = {
      id: uuidv4(),
      width,
      height,
      terrain,
      playerStart,
      boxStarts: [],
      goals: [],
      difficulty: 'microban',
      fileSource: 'custom',
      puzzleNumber: 0,
    }

    onLevelLoad(level)
    // Auto-enable editing mode for blank grids
    onEditingChange?.(true)
  }, [gridWidth, gridHeight, onLevelLoad, onEditingChange])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Select Prebuilt Levels
        </span>
      </div>

      <Separator />

      {/* Difficulty selector */}
      <Select
        value={difficulty}
        onValueChange={(v) => setDifficulty(v as Difficulty)}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
            <SelectItem key={d} value={d} className="text-xs">
              {DIFFICULTY_LABELS[d]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Difficulty info */}
      <div className="text-[10px] text-muted-foreground leading-tight">
        {DIFFICULTY_INFO[difficulty]}
      </div>

      {/* Error message */}
      {error && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded px-2 py-1.5">
          {error}
        </div>
      )}

      {/* Curated difficulty modes */}
      {isCurated ? (
        <>
          {/* Curated mode - single row controls */}
          <div className="flex gap-1 items-center">
            <Input
              type="text"
              value={puzzleNumber}
              onChange={(e) => {
                const val = Number.parseInt(e.target.value) || 1
                setPuzzleNumber(Math.min(curatedLevelCount, Math.max(1, val)))
              }}
              disabled={disabled}
              className="h-7 text-xs w-14 px-2 text-center"
              title={`Puzzle # (1-${curatedLevelCount})`}
            />
            <Button
              onClick={handlePrevCurated}
              disabled={disabled || puzzleNumber <= 1}
              size="sm"
              variant="secondary"
              className="h-7 px-1.5"
              title="Previous puzzle"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleNextCurated}
              disabled={disabled || puzzleNumber >= curatedLevelCount}
              size="sm"
              variant="secondary"
              className="h-7 px-1.5"
              title="Next puzzle"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleRandomCurated}
              disabled={disabled}
              size="sm"
              variant="secondary"
              className="h-7 px-1.5"
              title="Random puzzle"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </Button>
            <Button
              onClick={handleLoadCurated}
              disabled={disabled}
              size="sm"
              className="h-7 px-2 text-xs"
            >
              Load Level
            </Button>
          </div>

          {/* Source link */}
          <div className="text-[10px] text-muted-foreground">
            {difficulty === 'lmiq-reasoning-easy' ? (
              <>LMIQ Reasoning Easy eval set (100 generated puzzles)</>
            ) : difficulty === 'microban' ? (
              <>
                Microban by{' '}
                <a
                  href="http://www.bentonrea.com/~sasquatch/sokoban/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  David Skinner
                </a>
              </>
            ) : (
              <>
                {difficulty === 'classic-hard' ? 'Hard' : 'Medium'} levels from{' '}
                <a
                  href="https://github.com/google-deepmind/boxoban-levels"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  boxoban-levels
                </a>
              </>
            )}
          </div>

          {/* Solution controls */}
          {onComputeSolution && (
            <div className="flex items-center gap-1.5">
              {solution?.found ? (
                <>
                  <span className="text-[10px] text-muted-foreground">
                    Solution:{' '}
                    <span className="font-semibold text-foreground">{solution.moveCount}</span>{' '}
                    moves
                  </span>
                  {onRunSolution && canRunSolution && (
                    <Button
                      onClick={onRunSolution}
                      size="sm"
                      variant="secondary"
                      className="h-6 px-2 text-[10px] ml-auto"
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Run Solution Path
                    </Button>
                  )}
                </>
              ) : solution?.hitLimit ? (
                <span className="text-[10px] text-amber-500">Solver limit hit</span>
              ) : solution && !solution.found ? (
                <span className="text-[10px] text-amber-500">Puzzle Unsolvable</span>
              ) : (
                <Button
                  onClick={onComputeSolution}
                  disabled={disabled || isSolving}
                  size="sm"
                  variant="secondary"
                  className="h-6 px-2 text-[10px]"
                >
                  <Play className="w-3 h-3 mr-1" />
                  {isSolving ? 'Computing...' : 'Compute Solution'}
                </Button>
              )}
            </div>
          )}
        </>
      ) : null}

      {/* Create New Grid */}
      <Separator />
      <div className="space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Create New Grid
        </span>

        <div className="flex gap-1.5 items-end">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] text-muted-foreground">Width</span>
            <Input
              value={gridWidth}
              onChange={(e) => setGridWidth(Number(e.target.value) || 0)}
              disabled={disabled}
              className="h-7 text-xs w-14 px-2"
            />
          </div>
          <span className="text-muted-foreground text-xs pb-1.5">×</span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] text-muted-foreground">Height</span>
            <Input
              value={gridHeight}
              onChange={(e) => setGridHeight(Number(e.target.value) || 0)}
              disabled={disabled}
              className="h-7 text-xs w-14 px-2"
            />
          </div>
          <Button
            onClick={handleCreateBlankGrid}
            disabled={disabled}
            size="sm"
            variant="secondary"
            className="h-7 px-2 text-xs"
          >
            <Grid3X3 className="w-3.5 h-3.5 mr-1" />
            Create
          </Button>
        </div>
      </div>
    </div>
  )
}
