import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@sokoban-eval-toolkit/ui-library/components/card'
import { MOVE_KEYS } from '@src/constants'
import type { GameState, MoveDirection, SokobanLevel } from '@src/types'
import {
  executeMove,
  getBoxesOnGoalsCount,
  initializeGame,
  resetGame,
  undoMove,
} from '@src/utils/gameEngine'
import { generateLevel } from '@src/utils/levelGenerator'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AIPanel } from './components/AIPanel'
import { ControlPanel } from './components/ControlPanel'
import { LevelSelector } from './components/LevelSelector'
import { SokobanGrid } from './components/SokobanGrid'

export function SokobanGame() {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [currentLevel, setCurrentLevel] = useState<SokobanLevel | null>(null)
  const [aiInferenceTimeMs, setAiInferenceTimeMs] = useState<number | null>(null)
  const initialLoadDone = useRef(false)
  const [isPlayingSolution, setIsPlayingSolution] = useState(false)
  const solutionMovesRef = useRef<MoveDirection[]>([])
  const solutionIndexRef = useRef(0)
  const solutionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Handle level load
  const handleLevelLoad = useCallback((level: SokobanLevel) => {
    setCurrentLevel(level)
    setGameState(initializeGame(level))
    setAiInferenceTimeMs(null)
  }, [])

  // Auto-generate easy puzzle on mount
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    const level = generateLevel('easy')
    handleLevelLoad(level)
  }, [handleLevelLoad])

  // Handle move (returns true if valid)
  const handleMove = useCallback(
    (direction: MoveDirection): boolean => {
      if (!gameState || gameState.isWon) return false

      const newState = executeMove(gameState, direction, 'human')
      if (newState) {
        setGameState(newState)
        return true
      }
      return false
    },
    [gameState],
  )

  // Handle AI move (returns true if valid)
  const handleAIMove = useCallback(
    (direction: MoveDirection): boolean => {
      if (!gameState || gameState.isWon) return false

      const newState = executeMove(gameState, direction, 'ai')
      if (newState) {
        setGameState(newState)
        return true
      }
      return false
    },
    [gameState],
  )

  // Handle running solution - just stores the moves and starts playback
  const handleRunSolution = useCallback(
    (moves: MoveDirection[]) => {
      if (!gameState || moves.length === 0) return

      // Clear any existing solution playback
      if (solutionTimeoutRef.current) {
        clearTimeout(solutionTimeoutRef.current)
        solutionTimeoutRef.current = null
      }

      // Store moves and reset index
      solutionMovesRef.current = [...moves]
      solutionIndexRef.current = 0
      setIsPlayingSolution(true)
    },
    [gameState],
  )

  // Effect to process solution moves one at a time
  useEffect(() => {
    if (!isPlayingSolution) return
    if (!gameState) {
      setIsPlayingSolution(false)
      return
    }

    const moves = solutionMovesRef.current
    const index = solutionIndexRef.current

    // Check if we're done
    if (index >= moves.length || gameState.isWon) {
      setIsPlayingSolution(false)
      return
    }

    const direction = moves[index]
    if (!direction) {
      setIsPlayingSolution(false)
      return
    }

    // Schedule the next move
    solutionTimeoutRef.current = setTimeout(() => {
      const newState = executeMove(gameState, direction, 'ai')
      if (newState) {
        solutionIndexRef.current = index + 1
        setGameState(newState)
      } else {
        // Move failed, stop playback
        setIsPlayingSolution(false)
      }
    }, 300)

    return () => {
      if (solutionTimeoutRef.current) {
        clearTimeout(solutionTimeoutRef.current)
        solutionTimeoutRef.current = null
      }
    }
  }, [isPlayingSolution, gameState])

  // Handle undo
  const handleUndo = useCallback(() => {
    if (!gameState) return
    setGameState(undoMove(gameState))
  }, [gameState])

  // Reset to initial state
  const handleReset = useCallback(() => {
    if (!gameState) return
    setGameState(resetGame(gameState))
  }, [gameState])

  // Generate new puzzle (for generated difficulties)
  const handleRegenerate = useCallback(() => {
    const difficulty = currentLevel?.difficulty
    if (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') {
      const newLevel = generateLevel(difficulty)
      handleLevelLoad(newLevel)
    }
  }, [currentLevel, handleLevelLoad])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      // Movement
      if (MOVE_KEYS[e.key]) {
        e.preventDefault()
        handleMove(MOVE_KEYS[e.key])
        return
      }

      // Undo (Z or Backspace) - but not with meta keys
      if ((e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        handleUndo()
        return
      }

      // Reset (R) - but not with meta keys (e.g., Cmd+R should reload)
      if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        handleReset()
        return
      }

      // New puzzle (N) - regenerate for easy difficulty
      if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        handleRegenerate()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleMove, handleUndo, handleReset, handleRegenerate])

  const boxesOnGoals = gameState ? getBoxesOnGoalsCount(gameState) : 0
  const totalBoxes = gameState?.boxes.length ?? 0

  return (
    <div className="h-screen bg-background flex text-foreground overflow-hidden">
      {/* Left Sidebar - Controls */}
      <div className="flex-shrink-0 h-full p-4">
        <Card className="h-full flex flex-col min-h-0 w-80">
          <CardHeader className="flex-shrink-0 pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider">
              Sokoban Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-4 min-h-0">
            <LevelSelector onLevelLoad={handleLevelLoad} disabled={false} />
            <ControlPanel
              state={gameState}
              onUndo={handleUndo}
              onReset={handleReset}
              disabled={false}
              aiInferenceTimeMs={aiInferenceTimeMs}
              onRunSolution={handleRunSolution}
              isPlayingSolution={isPlayingSolution}
            />
          </CardContent>
        </Card>
      </div>

      {/* Center - Game Area */}
      <div className="flex-1 flex flex-col items-center justify-between px-5 py-6 min-w-0">
        {/* Top spacer */}
        <div className="flex-1" />

        {/* Main content */}
        <div className="flex flex-col items-center">
          {/* Title */}
          <h1 className="text-[13px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Sokoban Puzzle
          </h1>

          {/* Win message */}
          {gameState?.isWon && (
            <div className="text-green-500 mb-2 animate-pulse font-medium">Puzzle Solved!</div>
          )}

          {/* Progress */}
          {gameState && !gameState.isWon && (
            <div className="text-xs text-muted-foreground mb-3">
              Progress: {boxesOnGoals}/{totalBoxes} boxes on goals
              {currentLevel?.optimalMoves && (
                <span className="ml-2">· Optimal: {currentLevel.optimalMoves} moves</span>
              )}
            </div>
          )}

          {/* Grid */}
          <SokobanGrid state={gameState} />

          {/* Legend */}
          <div className="mt-3 flex gap-4 items-center text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[hsl(var(--sokoban-player))]" />
              <span>Player</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-[hsl(var(--sokoban-box))]" />
              <span>Box</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[hsl(var(--sokoban-goal))] opacity-60" />
              <span>Goal</span>
            </div>
          </div>

          {/* Completion stats */}
          {gameState?.isWon && (
            <div className="mt-3 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2 text-center">
              <div className="text-green-500 font-medium text-sm">
                Completed in {gameState.moveHistory.length} moves
                {currentLevel?.optimalMoves && (
                  <span className="text-green-400/80"> (optimal: {currentLevel.optimalMoves})</span>
                )}
              </div>
              <div className="text-green-400/70 text-xs mt-0.5">
                {gameState.moveHistory.filter((m) => m.wasPush).length} pushes
              </div>
            </div>
          )}

          {/* Level info */}
          {currentLevel && (
            <div className="mt-3 text-[11px] text-muted-foreground">
              {currentLevel.difficulty} / {currentLevel.fileSource} / #{currentLevel.puzzleNumber}
              <span className="mx-2">·</span>
              {currentLevel.width}×{currentLevel.height}
              <span className="mx-2">·</span>
              {currentLevel.boxStarts.length} boxes
            </div>
          )}
        </div>

        {/* Bottom spacer with instructions */}
        <div className="flex-1 flex flex-col justify-end">
          <div className="text-[11px] text-muted-foreground font-mono text-center">
            <span className="text-foreground/60">Arrow Keys</span> move ·{' '}
            <span className="text-foreground/60">Z/Backspace</span> undo ·{' '}
            <span className="text-foreground/60">R</span> reset ·{' '}
            <span className="text-foreground/60">N</span> new
          </div>
        </div>
      </div>

      {/* Right Sidebar - AI Panel */}
      <div className="flex-shrink-0 p-4 h-screen flex flex-col">
        <AIPanel
          state={gameState}
          onMove={handleAIMove}
          onReset={handleReset}
          disabled={!gameState}
          onInferenceTimeChange={setAiInferenceTimeMs}
        />
      </div>
    </div>
  )
}
