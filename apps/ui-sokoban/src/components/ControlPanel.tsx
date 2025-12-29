import { Button } from '@sokoban-eval-toolkit/ui-library/components/button'
import { Separator } from '@sokoban-eval-toolkit/ui-library/components/separator'
import type { GameState, MoveDirection } from '@src/types'
import { isSimpleDeadlock } from '@src/utils/gameEngine'
import { simpleSolve } from '@src/utils/simpleSolver'
import { type SolutionResult, getSolution } from '@src/utils/solutionCache'
import { AlertTriangle, RotateCcw, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

interface ControlPanelProps {
  state: GameState | null
  onUndo: () => void
  onReset: () => void
  disabled?: boolean
  aiInferenceTimeMs?: number | null
  onRunSolution?: (moves: MoveDirection[]) => void
  isPlayingSolution?: boolean
  isEditing?: boolean
}

export function ControlPanel({
  state,
  onUndo,
  onReset,
  disabled = false,
  aiInferenceTimeMs,
  onRunSolution,
  isPlayingSolution = false,
  isEditing = false,
}: ControlPanelProps) {
  const canUndo = state !== null && state.moveHistory.length > 0

  const displayTime = useMemo(() => {
    // If AI inference time is available, show that
    if (aiInferenceTimeMs != null && aiInferenceTimeMs > 0) {
      const seconds = Math.round(aiInferenceTimeMs / 1000)
      if (seconds < 60) return `${seconds}s`
      const minutes = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${minutes}m ${secs}s`
    }

    // Otherwise show game elapsed time
    if (!state?.startTime) return null
    const endTime = state.endTime ?? Date.now()
    const ms = endTime - state.startTime
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }, [state?.startTime, state?.endTime, aiInferenceTimeMs])

  const hasDeadlock = state ? isSimpleDeadlock(state) : false

  // Look up solution for the original level (cache first, then solver)
  const [solution, setSolution] = useState<SolutionResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!state?.level) {
      setSolution(null)
      return
    }

    // Use simple solver when editing (faster), full solver otherwise
    if (isEditing) {
      const result = simpleSolve(state.level)
      if (result.solvable && result.solution) {
        setSolution({
          found: true,
          solution: result.solution,
          moveCount: result.moveCount,
          source: 'solver',
        })
      } else {
        setSolution({ found: false, hitLimit: false })
      }
      return
    }

    setIsLoading(true)
    getSolution(state.level)
      .then(setSolution)
      .finally(() => setIsLoading(false))
  }, [state?.level, isEditing])

  // Calculate remaining moves from original solution
  const remainingMoves = useMemo(() => {
    if (!solution?.found || !state) return null
    // Remaining moves = original solution length - moves made so far
    const remaining = solution.moveCount - state.moveHistory.length
    return remaining > 0 ? remaining : 0
  }, [solution, state])

  // Get the solution moves
  const solutionMoves = useMemo(() => {
    if (!solution?.found || !state) return null
    return solution.solution
  }, [solution, state])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Game Stats
        </span>
      </div>

      <Separator />

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-muted/30 rounded-md px-2 py-1.5">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Moves</div>
          <div className="text-sm font-semibold tabular-nums">{state?.moveCount ?? 0}</div>
        </div>
        <div className="bg-muted/30 rounded-md px-2 py-1.5">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">
            {aiInferenceTimeMs != null && aiInferenceTimeMs > 0 ? 'AI Time' : 'Time'}
          </div>
          <div className="text-sm font-semibold tabular-nums">{displayTime ?? '--:--'}</div>
        </div>
      </div>

      {/* Solution info */}
      {state && !state.isWon && (
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          {isLoading ? (
            <span>Solving...</span>
          ) : solution?.found ? (
            <>
              <span>
                {state.moveHistory.length === 0 ? (
                  <>
                    Shortest Solution:{' '}
                    <span className="font-semibold text-foreground">{solution.moveCount}</span>{' '}
                    moves
                  </>
                ) : (
                  <>
                    Original:{' '}
                    <span className="font-semibold text-foreground">{solution.moveCount}</span>{' '}
                    moves
                    {remainingMoves !== null && remainingMoves > 0 && (
                      <span className="text-muted-foreground"> (~{remainingMoves} left)</span>
                    )}
                  </>
                )}
              </span>
              {onRunSolution && solutionMoves && state.moveHistory.length === 0 && (
                <Button
                  onClick={() => {
                    if (solutionMoves) {
                      onRunSolution(solutionMoves)
                    }
                  }}
                  disabled={disabled || isPlayingSolution}
                  size="sm"
                  variant="secondary"
                  className="h-5 px-1.5 text-[8px]"
                  title="Run solution"
                >
                  Run
                </Button>
              )}
            </>
          ) : solution?.hitLimit ? (
            <span className="text-amber-500">Solver limit hit (may be solvable)</span>
          ) : (
            <span className="text-amber-500">Puzzle Unsolved</span>
          )}
        </div>
      )}

      {/* Deadlock warning */}
      {hasDeadlock && !state?.isWon && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-amber-500 font-medium text-xs">Possible Deadlock</div>
            <div className="text-amber-500/70 text-[10px]">A box may be stuck. Try undoing.</div>
          </div>
        </div>
      )}

      <Separator />

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          onClick={onUndo}
          disabled={disabled || !canUndo}
          size="sm"
          variant="secondary"
          className="flex-1 h-8 text-xs"
        >
          <Undo2 className="w-3.5 h-3.5 mr-1" />
          Undo
        </Button>
        <Button
          onClick={onReset}
          disabled={disabled || !state}
          size="sm"
          variant="secondary"
          className="flex-1 h-8 text-xs"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          Reset
        </Button>
      </div>
    </div>
  )
}
