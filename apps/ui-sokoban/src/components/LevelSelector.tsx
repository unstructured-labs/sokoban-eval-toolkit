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
import { generateLevel } from '@src/utils/levelGenerator'
import { getMediumLevel, getMediumLevelCount, getRandomMediumLevel } from '@src/utils/levelLoader'
import { ChevronLeft, ChevronRight, Dices, Shuffle } from 'lucide-react'
import { useCallback, useState } from 'react'

// Difficulties that use procedural generation
const GENERATED_DIFFICULTIES: Exclude<Difficulty, 'classic'>[] = ['easy', 'medium', 'hard']

// Info text for each difficulty
const DIFFICULTY_INFO: Record<Difficulty, string> = {
  easy: '8×8 puzzles with 2 boxes. Quick to solve, great for learning.',
  medium: '9×9 puzzles with 3 boxes. More challenging with longer solutions.',
  hard: '10×10 puzzles with 4 boxes. Complex puzzles requiring careful planning.',
  classic: 'Curated puzzles from boxoban-levels (10×10, 4 boxes).',
}

interface LevelSelectorProps {
  onLevelLoad: (level: SokobanLevel) => void
  disabled?: boolean
}

export function LevelSelector({ onLevelLoad, disabled = false }: LevelSelectorProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [puzzleNumber, setPuzzleNumber] = useState<number>(1)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const classicLevelCount = getMediumLevelCount()
  const isGenerated = GENERATED_DIFFICULTIES.includes(difficulty as Exclude<Difficulty, 'classic'>)

  const handleLoadClassic = useCallback(() => {
    setError(null)
    const level = getMediumLevel(puzzleNumber - 1)
    if (level) {
      onLevelLoad(level)
    } else {
      setError(`Puzzle #${puzzleNumber} not found`)
    }
  }, [puzzleNumber, onLevelLoad])

  const handleRandomClassic = useCallback(() => {
    setError(null)
    const level = getRandomMediumLevel()
    setPuzzleNumber(level.puzzleNumber)
    onLevelLoad(level)
  }, [onLevelLoad])

  const handleGenerate = useCallback(() => {
    if (!isGenerated) return
    setError(null)
    setIsGenerating(true)

    // Use setTimeout to allow UI to update before potentially slow generation
    setTimeout(() => {
      try {
        const level = generateLevel(difficulty as Exclude<Difficulty, 'classic'>)
        onLevelLoad(level)
      } catch (err) {
        setError('Failed to generate puzzle')
        console.error(err)
      } finally {
        setIsGenerating(false)
      }
    }, 10)
  }, [difficulty, isGenerated, onLevelLoad])

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
        <Button
          onClick={handleGenerate}
          disabled={disabled || isGenerating}
          size="sm"
          className="w-full h-8 text-xs"
        >
          <Dices className="w-3.5 h-3.5 mr-1.5" />
          {isGenerating ? 'Generating...' : 'Generate Puzzle'}
        </Button>
      ) : (
        <>
          {/* Classic mode - embedded levels */}
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Puzzle # (1-{classicLevelCount})</span>
            <div className="flex gap-1">
              <Input
                type="number"
                min={1}
                max={classicLevelCount}
                value={puzzleNumber}
                onChange={(e) =>
                  setPuzzleNumber(
                    Math.min(classicLevelCount, Math.max(1, Number.parseInt(e.target.value) || 1)),
                  )
                }
                disabled={disabled}
                className="h-8 text-xs flex-1"
              />
              <Button
                onClick={() => setPuzzleNumber((n) => Math.max(1, n - 1))}
                disabled={disabled || puzzleNumber <= 1}
                size="sm"
                variant="secondary"
                className="h-8 px-2"
                title="Previous puzzle"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => setPuzzleNumber((n) => Math.min(classicLevelCount, n + 1))}
                disabled={disabled || puzzleNumber >= classicLevelCount}
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
              onClick={handleLoadClassic}
              disabled={disabled}
              size="sm"
              className="flex-1 h-8 text-xs"
            >
              Load Level
            </Button>
            <Button
              onClick={handleRandomClassic}
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
            Levels from{' '}
            <a
              href="https://github.com/google-deepmind/boxoban-levels"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              boxoban-levels
            </a>
          </div>
        </>
      )}
    </div>
  )
}
