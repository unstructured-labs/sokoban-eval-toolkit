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
import { Slider } from '@sokoban-eval-toolkit/ui-library/components/slider'
import { Switch } from '@sokoban-eval-toolkit/ui-library/components/switch'
import { DIFFICULTY_LABELS } from '@src/constants'
import type { Difficulty, SokobanLevel } from '@src/types'
import { generateEasyCustomLevel } from '@src/utils/easyCustomGenerator'
import { generateLevel } from '@src/utils/levelGenerator'
import {
  getHardLevel,
  getHardLevelCount,
  getMediumLevel,
  getMediumLevelCount,
  getMicrobanLevel,
  getMicrobanLevelCount,
  getRandomHardLevel,
  getRandomMediumLevel,
  getRandomMicrobanLevel,
} from '@src/utils/levelLoader'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Dices,
  FlipVertical,
  RotateCw,
  Shuffle,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

// Difficulties that use procedural generation
const GENERATED_DIFFICULTIES: Difficulty[] = ['easy', 'easy-custom', 'medium', 'hard']

// Difficulties that use curated level sets
const CURATED_DIFFICULTIES: Difficulty[] = ['classic', 'classic-hard', 'microban']

// Info text for each difficulty
const DIFFICULTY_INFO: Record<Difficulty, string> = {
  easy: '2 boxes. Quick to solve, great for learning.',
  'easy-custom': '1-3 boxes. Maze-based puzzles with corridor layouts.',
  medium: '3 boxes. More challenging with longer solutions.',
  hard: '4 boxes. Complex puzzles requiring careful planning.',
  classic: 'Medium difficulty puzzles from boxoban-levels (10×10, 4 boxes).',
  'classic-hard': 'Hard difficulty puzzles from boxoban-levels (10×10, 4 boxes).',
  microban: 'Classic beginner puzzles by David Skinner (155 levels).',
}

interface LevelSelectorProps {
  onLevelLoad: (level: SokobanLevel) => void
  disabled?: boolean
  currentLevel?: SokobanLevel | null
  isEditing?: boolean
  onEditingChange?: (editing: boolean) => void
  isVariantRules?: boolean
  onVariantRulesChange?: (enabled: boolean) => void
  isCustomPushingRules?: boolean
  onCustomPushingRulesChange?: (enabled: boolean) => void
  onFlipBoard?: () => void
  onRotateBoard?: () => void
}

export function LevelSelector({
  onLevelLoad,
  disabled = false,
  currentLevel,
  isEditing = false,
  onEditingChange,
  isVariantRules = false,
  onVariantRulesChange,
  isCustomPushingRules = false,
  onCustomPushingRulesChange,
  onFlipBoard,
  onRotateBoard,
}: LevelSelectorProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [puzzleNumber, setPuzzleNumber] = useState<number>(1)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [minSolutionSteps, setMinSolutionSteps] = useState(15)
  const [maxAttempts, setMaxAttempts] = useState(1000)
  const [gridSize, setGridSize] = useState(12)

  // Refs to avoid stale closures in setTimeout
  const settingsRef = useRef({ difficulty, minSolutionSteps, maxAttempts, gridSize })
  settingsRef.current = { difficulty, minSolutionSteps, maxAttempts, gridSize }

  const isGenerated = GENERATED_DIFFICULTIES.includes(difficulty)
  const isCurated = CURATED_DIFFICULTIES.includes(difficulty)

  // Get level count for curated difficulties
  const curatedLevelCount =
    difficulty === 'microban'
      ? getMicrobanLevelCount()
      : difficulty === 'classic'
        ? getMediumLevelCount()
        : difficulty === 'classic-hard'
          ? getHardLevelCount()
          : 0

  // Helper to get level based on current difficulty
  const getCuratedLevel = useCallback(
    (index: number) => {
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
      // Read from ref to get latest values (avoids stale closure)
      const {
        difficulty: diff,
        minSolutionSteps: minSteps,
        maxAttempts: attempts,
        gridSize: size,
      } = settingsRef.current
      try {
        let level: SokobanLevel
        if (diff === 'easy-custom') {
          // Use custom maze-based generator
          level = generateEasyCustomLevel()
        } else {
          level = generateLevel(
            diff as Exclude<Difficulty, 'classic' | 'classic-hard' | 'microban' | 'easy-custom'>,
            {
              minSolutionLength: minSteps,
              maxAttempts: attempts,
              gridSize: size,
            },
          )
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
          {/* Sliders only shown for non-custom difficulties */}
          {difficulty !== 'easy-custom' && (
            <>
              {/* Grid size slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Grid Size</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {gridSize}×{gridSize}
                  </span>
                </div>
                <Slider
                  value={[gridSize]}
                  onValueChange={([v]) => setGridSize(v)}
                  min={8}
                  max={30}
                  step={1}
                  disabled={disabled || isGenerating}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground/60">
                  <span>Small</span>
                  <span>Large</span>
                </div>
              </div>

              {/* Min solution steps slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Min Solution Steps</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {minSolutionSteps}
                  </span>
                </div>
                <Slider
                  value={[minSolutionSteps]}
                  onValueChange={([v]) => setMinSolutionSteps(v)}
                  min={3}
                  max={30}
                  step={1}
                  disabled={disabled || isGenerating}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground/60">
                  <span>Easy</span>
                  <span>Complex</span>
                </div>
              </div>

              {/* Max attempts slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Max Attempts</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{maxAttempts}</span>
                </div>
                <Slider
                  value={[maxAttempts]}
                  onValueChange={([v]) => setMaxAttempts(v)}
                  min={100}
                  max={10000}
                  step={100}
                  disabled={disabled || isGenerating}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground/60">
                  <span>Faster</span>
                  <span>More Tries</span>
                </div>
              </div>
            </>
          )}

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
            {difficulty === 'microban' ? (
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

        {/* Enable Variant Rules toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="variant-rules" className="text-xs text-muted-foreground cursor-pointer">
            Enable Variant Rules
          </Label>
          <Switch
            id="variant-rules"
            checked={isVariantRules}
            onCheckedChange={onVariantRulesChange}
            disabled={disabled || !currentLevel}
          />
        </div>

        {/* Enable Custom Pushing Rules toggle */}
        <div className="flex items-center justify-between">
          <Label
            htmlFor="custom-pushing-rules"
            className="text-xs text-muted-foreground cursor-pointer"
          >
            Enable Custom Pushing
          </Label>
          <Switch
            id="custom-pushing-rules"
            checked={isCustomPushingRules}
            onCheckedChange={onCustomPushingRulesChange}
            disabled={disabled || !currentLevel}
          />
        </div>

        {/* Flip and Rotate buttons */}
        <div className="flex gap-2">
          <Button
            onClick={onFlipBoard}
            disabled={disabled || !currentLevel}
            size="sm"
            variant="secondary"
            className="flex-1 h-8 text-xs"
          >
            <FlipVertical className="w-3.5 h-3.5 mr-1.5" />
            Flip Board
          </Button>
          <Button
            onClick={onRotateBoard}
            disabled={disabled || !currentLevel}
            size="sm"
            variant="secondary"
            className="flex-1 h-8 text-xs"
          >
            <RotateCw className="w-3.5 h-3.5 mr-1.5" />
            Rotate Board
          </Button>
        </div>
      </div>
    </div>
  )
}
