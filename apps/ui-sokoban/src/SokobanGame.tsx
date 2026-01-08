import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@sokoban-eval-toolkit/ui-library/components/card'
import { BOX_COLORS, MOVE_KEYS } from '@src/constants'
import { useEditMode, useGameState, useLayoutPersistence } from '@src/hooks'
import type { HumanSession, MoveDirection, SokobanLevel } from '@src/types'
import { getBoxesOnGoalsCount } from '@src/utils/gameEngine'
import { getLmiqLevel } from '@src/utils/levelLoader'
import { type SolutionResult, getSolution } from '@src/utils/solutionCache'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AIPanel } from './components/AIPanel'
import { ControlPanel } from './components/ControlPanel'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LevelSelector } from './components/LevelSelector'
import { SokobanGrid } from './components/SokobanGrid'

export function SokobanGame() {
  const [isEditing, setIsEditing] = useState(true)
  const [coloredBoxRules, setColoredBoxRules] = useState(false)
  const initialLoadDone = useRef(false)

  // Use custom hooks for game state management
  const {
    gameState,
    setGameState,
    currentLevel,
    setCurrentLevel,
    isPlayingSolution,
    handleLevelLoad,
    handleMove,
    handleAIMove,
    handleUndo,
    handleReset,
    handleRunSolution,
  } = useGameState()

  // Use custom hook for edit mode
  const {
    selectedEntity,
    setSelectedEntity,
    isDraggingWalls,
    addMode,
    setAddMode,
    handleCellClick,
    handleCellDragStart,
    handleCellDragEnter,
    handleDragEnd,
  } = useEditMode({
    gameState,
    setGameState,
    setCurrentLevel,
    isEditing,
  })

  // Use custom hook for layout persistence
  const {
    savedLayouts,
    layoutName,
    setLayoutName,
    handleSaveLayout,
    handleLoadLayout,
    handleDeleteLayout,
    handleReorderLayouts,
    handleRenameLayout,
  } = useLayoutPersistence({
    gameState,
    onLayoutLoad: (level: SokobanLevel) => {
      handleLevelLoad(level)
      setLayoutName(level.id.replace('saved-', ''))
    },
  })

  // Selected layout tracking
  const [selectedLayoutName, setSelectedLayoutName] = useState<string | null>(null)

  // Solution state management
  const [solution, setSolution] = useState<SolutionResult | null>(null)
  const [isSolving, setIsSolving] = useState(false)
  const lastSolvedLevelId = useRef<string | null>(null)

  // Reset solution when level changes
  useEffect(() => {
    if (gameState?.level.id !== lastSolvedLevelId.current) {
      setSolution(null)
    }
  }, [gameState?.level.id])

  const handleComputeSolution = useCallback(() => {
    if (!gameState?.level || isSolving) return

    setIsSolving(true)
    lastSolvedLevelId.current = gameState.level.id
    getSolution(gameState.level)
      .then(setSolution)
      .finally(() => setIsSolving(false))
  }, [gameState?.level, isSolving])

  const solutionMoves = useMemo(() => {
    if (!solution?.found || !gameState) return null
    return solution.solution
  }, [solution, gameState])

  // Human session state management
  const [humanSession, setHumanSession] = useState<HumanSession | null>(null)
  const sessionLevelIdRef = useRef<string | null>(null)

  // Start a human player session (clears any existing session)
  const handleStartSession = useCallback(() => {
    if (!gameState) return

    // Reset the puzzle first
    handleReset()

    // Start fresh session
    const levelId = gameState.level.id
    setHumanSession({
      isActive: true,
      startTime: Date.now(),
      totalSteps: 0,
      stepsAtLastReset: 0,
      restarts: 0,
      levelId,
    })
    sessionLevelIdRef.current = levelId
  }, [gameState, handleReset])

  // End the human player session (but keep stats visible)
  const handleEndSession = useCallback(() => {
    setHumanSession((prev) => (prev ? { ...prev, isActive: false, endTime: Date.now() } : null))
  }, [])

  // Clear session data entirely
  const clearSession = useCallback(() => {
    setHumanSession(null)
    sessionLevelIdRef.current = null
  }, [])

  // Track steps during session (cumulative across resets)
  useEffect(() => {
    if (!humanSession?.isActive || !gameState) return

    setHumanSession((prev) => {
      if (!prev) return null
      return {
        ...prev,
        totalSteps: prev.stepsAtLastReset + gameState.moveHistory.length,
      }
    })
  }, [gameState?.moveHistory.length, humanSession?.isActive, gameState])

  // Reset clears completed session stats, but keeps active session running
  const handleSessionReset = useCallback(() => {
    if (humanSession) {
      if (humanSession.isActive) {
        // Save current steps and increment restart count
        setHumanSession((prev) =>
          prev ? { ...prev, stepsAtLastReset: prev.totalSteps, restarts: prev.restarts + 1 } : null,
        )
      } else {
        // Clear completed session stats
        clearSession()
      }
    }
    handleReset()
  }, [humanSession, handleReset, clearSession])

  // Auto-clear session on level change (but not on edit)
  useEffect(() => {
    if (!humanSession) return

    const currentLevelId = gameState?.level.id
    if (currentLevelId && currentLevelId !== sessionLevelIdRef.current) {
      // Level changed, clear session entirely
      clearSession()
    }
  }, [gameState?.level.id, humanSession, clearSession])

  // Auto-end session when puzzle is won
  useEffect(() => {
    if (humanSession?.isActive && gameState?.isWon) {
      handleEndSession()
    }
  }, [gameState?.isWon, humanSession?.isActive, handleEndSession])

  // Load first LMIQ puzzle on mount
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    const level = getLmiqLevel(0)
    if (level) {
      handleLevelLoad(level)
    }
  }, [handleLevelLoad])

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
        handleMove(MOVE_KEYS[e.key] as MoveDirection)
        return
      }

      // Undo (Z or Backspace) - but not with meta keys
      if ((e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        handleUndo()
        return
      }

      // Reset (R) - but not with meta keys
      if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        handleSessionReset()
        return
      }

      // Edit mode hotkeys
      if (isEditing) {
        // Wall (W)
        if (e.key === 'w' || e.key === 'W') {
          e.preventDefault()
          setAddMode((prev) => (prev === 'wall' ? null : 'wall'))
          return
        }

        // Goal (G)
        if (e.key === 'g' || e.key === 'G') {
          e.preventDefault()
          setAddMode((prev) => (prev === 'goal' ? null : 'goal'))
          return
        }

        // Orange (O)
        if (e.key === 'o' || e.key === 'O') {
          e.preventDefault()
          setAddMode((prev) => (prev === 'orange' ? null : 'orange'))
          return
        }

        // Purple (P)
        if (e.key === 'p' || e.key === 'P') {
          e.preventDefault()
          setAddMode((prev) => (prev === 'purple' ? null : 'purple'))
          return
        }

        // Emerald (E)
        if (e.key === 'e' || e.key === 'E') {
          e.preventDefault()
          setAddMode((prev) => (prev === 'emerald' ? null : 'emerald'))
          return
        }

        // Sky (S)
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault()
          setAddMode((prev) => (prev === 'sky' ? null : 'sky'))
          return
        }

        // Remove/Delete (D)
        if (e.key === 'd' || e.key === 'D') {
          e.preventDefault()
          setAddMode((prev) => (prev === 'remove' ? null : 'remove'))
          return
        }

        // Deselect all (Escape)
        if (e.key === 'Escape') {
          e.preventDefault()
          setAddMode(null)
          setSelectedEntity(null)
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleMove, handleUndo, handleSessionReset, isEditing, setAddMode, setSelectedEntity])

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
            <LevelSelector
              onLevelLoad={handleLevelLoad}
              disabled={false}
              onEditingChange={setIsEditing}
              solution={solution}
              isSolving={isSolving}
              onComputeSolution={handleComputeSolution}
              onRunSolution={solutionMoves ? () => handleRunSolution(solutionMoves) : undefined}
              canRunSolution={
                !!solutionMoves && gameState?.moveHistory.length === 0 && !isPlayingSolution
              }
            />
            <ControlPanel
              state={gameState}
              savedLayouts={savedLayouts}
              layoutName={layoutName}
              onLayoutNameChange={setLayoutName}
              onSaveLayout={handleSaveLayout}
              onLoadLayout={(name) => {
                handleLoadLayout(name)
                setSelectedLayoutName(name)
              }}
              onDeleteLayout={handleDeleteLayout}
              onReorderLayouts={handleReorderLayouts}
              onRenameLayout={handleRenameLayout}
              selectedLayoutName={selectedLayoutName}
              onSelectedLayoutChange={setSelectedLayoutName}
              humanSession={humanSession}
              onStartSession={handleStartSession}
              onEndSession={handleEndSession}
            />
          </CardContent>
        </Card>
      </div>

      {/* Center - Game Area */}
      <div className="flex-1 flex flex-col items-center px-5 py-4 min-w-0">
        {/* Editing controls - at top */}
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          {/* Edit toggle */}
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            disabled={!currentLevel}
            className={`h-8 px-3 text-xs rounded border focus:outline-none whitespace-nowrap transition-colors ${
              isEditing
                ? 'bg-primary/20 text-primary border-primary/50'
                : 'bg-muted/50 hover:bg-muted text-muted-foreground border-border'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isEditing ? 'Editing' : 'Edit Level'}
          </button>

          {/* Show edit tools only when editing */}
          {isEditing && (
            <>
              <div className="w-px h-6 bg-border" />
              <button
                type="button"
                onClick={() => setAddMode(addMode === 'wall' ? null : 'wall')}
                className={`h-8 px-2 text-xs rounded border focus:outline-none whitespace-nowrap ${
                  addMode === 'wall'
                    ? 'bg-[hsl(var(--sokoban-wall))]/40 text-foreground border-[hsl(var(--sokoban-wall))]'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground border-border'
                }`}
              >
                Wall
              </button>
              <button
                type="button"
                onClick={() => setAddMode(addMode === 'goal' ? null : 'goal')}
                className={`h-8 px-2 text-xs rounded border focus:outline-none whitespace-nowrap ${
                  addMode === 'goal'
                    ? 'bg-[hsl(var(--sokoban-goal))]/20 text-[hsl(var(--sokoban-goal))] border-[hsl(var(--sokoban-goal))]/50'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground border-border'
                }`}
              >
                + Goal
              </button>
              {/* Colored box buttons */}
              {(['orange', 'purple', 'emerald', 'sky'] as const).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAddMode(addMode === color ? null : color)}
                  className={`h-8 px-2 text-xs rounded border focus:outline-none whitespace-nowrap ${
                    addMode === color ? 'border-2' : 'bg-muted/50 hover:bg-muted border-border'
                  }`}
                  style={{
                    backgroundColor: addMode === color ? `${BOX_COLORS[color].bg}33` : undefined,
                    color: BOX_COLORS[color].bg,
                    borderColor: addMode === color ? BOX_COLORS[color].bg : undefined,
                  }}
                >
                  + {color.charAt(0).toUpperCase() + color.slice(1)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAddMode(addMode === 'remove' ? null : 'remove')}
                className={`h-8 px-2 text-xs rounded border focus:outline-none whitespace-nowrap ${
                  addMode === 'remove'
                    ? 'bg-red-500/20 text-red-500 border-red-500/50'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground border-border'
                }`}
              >
                Remove
              </button>
            </>
          )}
        </div>

        {/* Edit hotkeys hint */}
        {isEditing && (
          <div className="text-[10px] text-muted-foreground/70 font-mono mb-1">
            <span className="text-foreground/50">W</span> wall ·{' '}
            <span className="text-foreground/50">G</span> goal ·{' '}
            <span className="text-foreground/50">O</span> orange ·{' '}
            <span className="text-foreground/50">P</span> purple ·{' '}
            <span className="text-foreground/50">E</span> emerald ·{' '}
            <span className="text-foreground/50">S</span> sky ·{' '}
            <span className="text-foreground/50">D</span> remove ·{' '}
            <span className="text-foreground/50">Esc</span> deselect
          </div>
        )}

        {/* Main content - centered */}
        <div className="flex-1 flex flex-col items-center justify-center">
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
            </div>
          )}

          {/* Grid */}
          <SokobanGrid
            state={gameState}
            isEditing={isEditing}
            onCellClick={handleCellClick}
            selectedEntity={selectedEntity}
            onCellDragStart={handleCellDragStart}
            onCellDragEnter={handleCellDragEnter}
            onDragEnd={handleDragEnd}
            isDragging={isDraggingWalls}
            addMode={addMode}
          />

          {/* Legend */}
          <div className="mt-3 flex gap-4 items-center text-[11px] text-muted-foreground flex-wrap justify-center">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">👷</span>
              <span>Player</span>
            </div>
            {(['orange', 'purple', 'emerald', 'sky'] as const).map((color) => (
              <div key={color} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: BOX_COLORS[color].bg }}
                />
                <span>{color.charAt(0).toUpperCase() + color.slice(1)}</span>
              </div>
            ))}
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
              {currentLevel.generationIterations && (
                <>
                  <span className="mx-2">·</span>
                  Generated in {currentLevel.generationIterations} iteration
                  {currentLevel.generationIterations !== 1 ? 's' : ''}
                </>
              )}
            </div>
          )}

          {/* Colored box rules indicator */}
          {coloredBoxRules && (
            <div className="mt-1.5 text-[10px] text-amber-500/80 italic">
              Colored box variant: boxes can only be pushed onto goals of the same color
            </div>
          )}
        </div>

        {/* Bottom instructions */}
        <div className="flex-shrink-0 pt-4">
          <div className="text-[11px] text-muted-foreground font-mono text-center">
            <span className="text-foreground/60">Arrow Keys</span> move ·{' '}
            <span className="text-foreground/60">Z/Backspace</span> undo ·{' '}
            <span className="text-foreground/60">R</span> reset
          </div>
        </div>
      </div>

      {/* Right Sidebar - AI Panel with Error Boundary */}
      <div className="flex-shrink-0 p-4 h-screen flex flex-col">
        <ErrorBoundary fallbackTitle="AI Panel Error" onReset={handleReset}>
          <AIPanel
            state={gameState}
            onMove={handleAIMove}
            onReset={handleReset}
            disabled={!gameState}
            isEditing={isEditing}
            coloredBoxRules={coloredBoxRules}
            onColoredBoxRulesChange={setColoredBoxRules}
          />
        </ErrorBoundary>
      </div>
    </div>
  )
}
