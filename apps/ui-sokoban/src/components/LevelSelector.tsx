import { Button } from '@sokoban-eval-toolkit/ui-library/components/button'
import { Input } from '@sokoban-eval-toolkit/ui-library/components/input'
import { Label } from '@sokoban-eval-toolkit/ui-library/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sokoban-eval-toolkit/ui-library/components/select'
import { Separator } from '@sokoban-eval-toolkit/ui-library/components/separator'
import { Switch } from '@sokoban-eval-toolkit/ui-library/components/switch'
import { DIFFICULTY_LABELS } from '@src/constants'
import type { Difficulty, SokobanLevel } from '@src/types'
import { generateEvalEasyLevel } from '@src/utils/evalEasyGenerator'
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
import { generateMixedCustomLevel } from '@src/utils/mixedCustomGenerator'
import { AlertTriangle, ChevronLeft, ChevronRight, Dices, Grid3X3, Shuffle } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'

// Difficulties that use procedural generation
const GENERATED_DIFFICULTIES: Difficulty[] = ['eval-easy', 'mixed-custom']

// Difficulties that use curated level sets
const CURATED_DIFFICULTIES: Difficulty[] = [
  'lmiq-reasoning-easy',
  'classic',
  'classic-hard',
  'microban',
]

// Info text for each difficulty
const DIFFICULTY_INFO: Record<Difficulty, string> = {
  'eval-easy': '1-3 boxes. Very easy puzzles with sparse walls (4-12 grid).',
  'mixed-custom': '2-4 boxes. Random maze-based puzzles (8-12 grid).',
  'lmiq-reasoning-easy': 'LM IQ benchmark puzzles. 1-4 boxes, 4-10 grid (100 levels).',
  microban: 'Classic beginner puzzles by David Skinner (155 levels).',
  classic: 'Medium difficulty puzzles from boxoban-levels (10×10, 4 boxes).',
  'classic-hard': 'Hard difficulty puzzles from boxoban-levels (10×10, 4 boxes).',
}

interface LevelSelectorProps {
  onLevelLoad: (level: SokobanLevel) => void
  disabled?: boolean
  currentLevel?: SokobanLevel | null
  isEditing?: boolean
  onEditingChange?: (editing: boolean) => void
}

export function LevelSelector({
  onLevelLoad,
  disabled = false,
  currentLevel,
  isEditing = false,
  onEditingChange,
}: LevelSelectorProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('eval-easy')
  const [puzzleNumber, setPuzzleNumber] = useState<number>(1)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [gridWidth, setGridWidth] = useState<number>(8)
  const [gridHeight, setGridHeight] = useState<number>(8)

  // Ref to avoid stale closures in setTimeout
  const difficultyRef = useRef(difficulty)
  difficultyRef.current = difficulty

  const isGenerated = GENERATED_DIFFICULTIES.includes(difficulty)
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

  const handleGenerate = useCallback(() => {
    if (!isGenerated) return
    setError(null)
    setIsGenerating(true)

    // Use setTimeout to allow UI to update before potentially slow generation
    setTimeout(() => {
      const diff = difficultyRef.current
      try {
        let level: SokobanLevel
        if (diff === 'eval-easy') {
          level = generateEvalEasyLevel()
        } else {
          level = generateMixedCustomLevel()
        }
        onLevelLoad(level)
      } catch (err) {
        setError('Failed to generate puzzle')
        console.error(err)
      } finally {
        setIsGenerating(false)
      }
    }, 10)
  }, [isGenerated, onLevelLoad])

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
      difficulty: 'mixed-custom',
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
          Level Selection
        </span>
      </div>

      <Separator />

      {/* Difficulty selector */}
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">Difficulty</span>
        <Select
          value={difficulty}
          onValueChange={(v) => setDifficulty(v as Difficulty)}
          disabled={disabled || isGenerating}
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
      </div>

      {/* Difficulty info */}
      <div className="bg-muted/30 rounded-md px-3 py-2 text-xs text-muted-foreground">
        {DIFFICULTY_INFO[difficulty]}
      </div>

      {/* Error message */}
      {error && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded px-2 py-1.5">
          {error}
        </div>
      )}

      {/* Generated difficulty modes */}
      {isGenerated ? (
        <>
          {/* Generation stats from last puzzle */}
          {currentLevel?.generationIterations && (
            <div
              className={`rounded-md px-3 py-2 text-xs ${
                currentLevel.usedFallback
                  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400'
                  : 'bg-muted/30 text-muted-foreground'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {currentLevel.usedFallback && <AlertTriangle className="w-3.5 h-3.5" />}
                <span>
                  Generated in {currentLevel.generationIterations} iteration
                  {currentLevel.generationIterations !== 1 ? 's' : ''}
                  {currentLevel.optimalMoves && ` · ${currentLevel.optimalMoves} moves`}
                </span>
              </div>
              {currentLevel.usedFallback && (
                <div className="text-[10px] mt-1 opacity-80">
                  Fallback puzzle used - try lowering min steps
                </div>
              )}
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={disabled || isGenerating}
            size="sm"
            className="w-full h-8 text-xs"
          >
            <Dices className="w-3.5 h-3.5 mr-1.5" />
            {isGenerating ? 'Generating...' : 'Generate Puzzle'}
          </Button>
        </>
      ) : isCurated ? (
        <>
          {/* Curated mode - embedded levels */}
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Puzzle # (1-{curatedLevelCount})</span>
            <div className="flex gap-1">
              <Input
                type="number"
                min={1}
                max={curatedLevelCount}
                value={puzzleNumber}
                onChange={(e) =>
                  setPuzzleNumber(
                    Math.min(curatedLevelCount, Math.max(1, Number.parseInt(e.target.value) || 1)),
                  )
                }
                disabled={disabled}
                className="h-8 text-xs flex-1"
              />
              <Button
                onClick={handlePrevCurated}
                disabled={disabled || puzzleNumber <= 1}
                size="sm"
                variant="secondary"
                className="h-8 px-2"
                title="Previous puzzle"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleNextCurated}
                disabled={disabled || puzzleNumber >= curatedLevelCount}
                size="sm"
                variant="secondary"
                className="h-8 px-2"
                title="Next puzzle"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleLoadCurated}
              disabled={disabled}
              size="sm"
              className="flex-1 h-8 text-xs"
            >
              Load Level
            </Button>
            <Button
              onClick={handleRandomCurated}
              disabled={disabled}
              size="sm"
              variant="secondary"
              className="h-8"
              title="Random puzzle"
            >
              <Shuffle className="w-3.5 h-3.5" />
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
        </>
      ) : null}

      {/* Customization section - always visible */}
      <Separator />
      <div className="space-y-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Customization
        </span>

        {/* Enable Editing toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="edit-mode" className="text-xs text-muted-foreground cursor-pointer">
            Enable Editing
          </Label>
          <Switch
            id="edit-mode"
            checked={isEditing}
            onCheckedChange={onEditingChange}
            disabled={disabled || !currentLevel}
          />
        </div>
      </div>

      {/* Create New Grid */}
      <Separator />
      <div className="space-y-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Create New Grid
        </span>

        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">Width</Label>
            <Input
              value={gridWidth}
              onChange={(e) => setGridWidth(Number(e.target.value) || 0)}
              disabled={disabled}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">Height</Label>
            <Input
              value={gridHeight}
              onChange={(e) => setGridHeight(Number(e.target.value) || 0)}
              disabled={disabled}
              className="h-8 text-xs"
            />
          </div>
        </div>

        <Button
          onClick={handleCreateBlankGrid}
          disabled={disabled}
          size="sm"
          variant="secondary"
          className="w-full h-8 text-xs"
        >
          <Grid3X3 className="w-3.5 h-3.5 mr-1.5" />
          Create Grid
        </Button>
      </div>
    </div>
  )
}
