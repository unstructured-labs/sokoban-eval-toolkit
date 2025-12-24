import { Button } from '@sokoban-eval-toolkit/ui-library/components/button'
import { Separator } from '@sokoban-eval-toolkit/ui-library/components/separator'
import type { GameState, MoveDirection } from '@src/types'
import { getBoxesOnGoalsCount, isSimpleDeadlock } from '@src/utils/gameEngine'
import { solvePuzzle } from '@src/utils/sokobanSolver'
import { AlertTriangle, RotateCcw, Undo2 } from 'lucide-react'
import { useMemo } from 'react'

interface ControlPanelProps {
  state: GameState | null
  onUndo: () => void
  onReset: () => void
  disabled?: boolean
  aiInferenceTimeMs?: number | null
  onRunSolution?: (moves: MoveDirection[]) => void
  isPlayingSolution?: boolean
}

export function ControlPanel({
  state,
  onUndo,
  onReset,
  disabled = false,
  aiInferenceTimeMs,
  onRunSolution,
  isPlayingSolution = false,
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

  const boxesOnGoals = state ? getBoxesOnGoalsCount(state) : 0
  const totalBoxes = state?.boxes.length ?? 0
  const hasDeadlock = state ? isSimpleDeadlock(state) : false

  // Compute optimal solution from current state
  const solverResult = useMemo(() => {
    if (!state || state.isWon) return null

    // Create a temporary level with current positions
    const tempLevel = {
      ...state.level,
      playerStart: state.playerPos,
      boxStarts: state.boxes,
    }

    const result = solvePuzzle(tempLevel, 50000)
    return result.solvable ? { moveCount: result.moveCount, solution: result.solution } : null
  }, [state])

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
        <div className="bg-muted/30 rounded-md px-3 py-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Moves</div>
          <div className="text-lg font-semibold tabular-nums">{state?.moveCount ?? 0}</div>
        </div>
        <div className="bg-muted/30 rounded-md px-3 py-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Pushes</div>
          <div className="text-lg font-semibold tabular-nums">{state?.pushCount ?? 0}</div>
        </div>
        <div className="bg-muted/30 rounded-md px-3 py-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Progress</div>
          <div className="text-lg font-semibold tabular-nums">
            {boxesOnGoals}/{totalBoxes}
          </div>
        </div>
        <div className="bg-muted/30 rounded-md px-3 py-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {aiInferenceTimeMs != null && aiInferenceTimeMs > 0 ? 'AI Time' : 'Time'}
          </div>
          <div className="text-lg font-semibold tabular-nums">{displayTime ?? '--:--'}</div>
        </div>
      </div>

      {/* Solver optimal solution */}
      {state && !state.isWon && (
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          {solverResult !== null ? (
            <>
              <span>
                Shortest Solution:{' '}
                <span className="font-semibold text-foreground">{solverResult.moveCount}</span>{' '}
                moves
              </span>
              {onRunSolution && solverResult.solution && (
                <Button
                  onClick={() => {
                    if (solverResult.solution) {
                      onRunSolution(solverResult.solution)
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
          ) : (
            <span className="text-amber-500">No solution found</span>
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
