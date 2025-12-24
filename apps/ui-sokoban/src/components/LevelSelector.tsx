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
import { generateEasyLevel } from '@src/utils/levelGenerator'
import { getMediumLevel, getMediumLevelCount, getRandomMediumLevel } from '@src/utils/levelLoader'
import { Dices, Shuffle } from 'lucide-react'
import { useCallback, useState } from 'react'

interface LevelSelectorProps {
  onLevelLoad: (level: SokobanLevel) => void
  disabled?: boolean
}

export function LevelSelector({ onLevelLoad, disabled = false }: LevelSelectorProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [puzzleNumber, setPuzzleNumber] = useState<number>(1)
  const [error, setError] = useState<string | null>(null)

  const mediumLevelCount = getMediumLevelCount()

  const handleLoadMedium = useCallback(() => {
    setError(null)
    const level = getMediumLevel(puzzleNumber - 1)
    if (level) {
      onLevelLoad(level)
    } else {
      setError(`Puzzle #${puzzleNumber} not found`)
    }
  }, [puzzleNumber, onLevelLoad])

  const handleRandomMedium = useCallback(() => {
    setError(null)
    const level = getRandomMediumLevel()
    setPuzzleNumber(level.puzzleNumber)
    onLevelLoad(level)
  }, [onLevelLoad])

  const handleGenerateEasy = useCallback(() => {
    setError(null)
    try {
      const level = generateEasyLevel()
      onLevelLoad(level)
    } catch (err) {
      setError('Failed to generate puzzle')
      console.error(err)
    }
  }, [onLevelLoad])

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
      </div>

      {/* Easy mode - procedural generation */}
      {difficulty === 'easy' ? (
        <>
          <div className="bg-muted/30 rounded-md px-3 py-2 text-xs text-muted-foreground">
            Procedurally generated 8x8 puzzles with 1 box. Each puzzle is guaranteed solvable.
          </div>

          {/* Error message */}
          {error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded px-2 py-1.5">
              {error}
            </div>
          )}

          {/* Generate button */}
          <Button
            onClick={handleGenerateEasy}
            disabled={disabled}
            size="sm"
            className="w-full h-8 text-xs"
          >
            <Dices className="w-3.5 h-3.5 mr-1.5" />
            Generate Puzzle
          </Button>
        </>
      ) : (
        <>
          {/* Medium mode - embedded levels */}
          <div className="bg-muted/30 rounded-md px-3 py-2 text-xs text-muted-foreground">
            {mediumLevelCount} puzzles from boxoban-levels (10x10, 4 boxes).
          </div>

          {/* Puzzle number */}
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Puzzle # (1-{mediumLevelCount})</span>
            <Input
              type="number"
              min={1}
              max={mediumLevelCount}
              value={puzzleNumber}
              onChange={(e) =>
                setPuzzleNumber(
                  Math.min(mediumLevelCount, Math.max(1, Number.parseInt(e.target.value) || 1)),
                )
              }
              disabled={disabled}
              className="h-8 text-xs"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded px-2 py-1.5">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleLoadMedium}
              disabled={disabled}
              size="sm"
              className="flex-1 h-8 text-xs"
            >
              Load Level
            </Button>
            <Button
              onClick={handleRandomMedium}
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
