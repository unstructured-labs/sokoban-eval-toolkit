import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@sokoban-eval-toolkit/ui-library/components/card'
import { BOX_COLORS, MOVE_KEYS } from '@src/constants'
import { useEditMode, useGameState, useLayoutPersistence } from '@src/hooks'
import type { MoveDirection, SokobanLevel } from '@src/types'
import { generateEvalEasyLevel } from '@src/utils/evalEasyGenerator'
import { getBoxesOnGoalsCount } from '@src/utils/gameEngine'
import { generateMixedCustomLevel } from '@src/utils/mixedCustomGenerator'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AIPanel } from './components/AIPanel'
import { ControlPanel } from './components/ControlPanel'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LevelSelector } from './components/LevelSelector'
import { SavedLayoutsOverlay } from './components/SavedLayoutsOverlay'
import { SokobanGrid } from './components/SokobanGrid'

export function SokobanGame() {
  const [aiInferenceTimeMs, setAiInferenceTimeMs] = useState<number | null>(null)
  const [isEditing, setIsEditing] = useState(true)
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
  } = useGameState({
    onLevelLoad: () => setAiInferenceTimeMs(null),
  })

  // Use custom hook for edit mode
  const {
    selectedEntity,
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
  } = useLayoutPersistence({
    gameState,
    onLayoutLoad: (level: SokobanLevel) => {
      handleLevelLoad(level)
      setLayoutName(level.id.replace('saved-', ''))
    },
  })

  // Auto-generate easy puzzle on mount
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    const level = generateEvalEasyLevel()
    handleLevelLoad(level)
  }, [handleLevelLoad])

  // Generate new puzzle (for generated difficulties)
  const handleRegenerate = useCallback(() => {
    const difficulty = currentLevel?.difficulty
    if (difficulty === 'eval-easy') {
      const newLevel = generateEvalEasyLevel()
      handleLevelLoad(newLevel)
    } else if (difficulty === 'mixed-custom') {
      const newLevel = generateMixedCustomLevel()
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
        handleReset()
        return
      }

      // New puzzle (N) - regenerate for easy difficulty
      if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        handleRegenerate()
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

        // Remove (Escape)
        if (e.key === 'Escape') {
          e.preventDefault()
          setAddMode((prev) => (prev === 'remove' ? null : 'remove'))
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleMove, handleUndo, handleReset, handleRegenerate, isEditing, setAddMode])

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
              currentLevel={currentLevel}
              isEditing={isEditing}
              onEditingChange={setIsEditing}
            />
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
      <div className="flex-1 flex flex-col items-center px-5 py-6 min-w-0">
        {/* Save/Load layouts UI - at top */}
        <div className="flex-1 flex flex-col justify-start">
          <div className="flex items-start gap-2">
            <SavedLayoutsOverlay
              layouts={savedLayouts}
              onLoad={handleLoadLayout}
              onDelete={handleDeleteLayout}
            />
            {/* Controls wrapper - stays aligned at top with consistent height */}
            <div className="flex items-center gap-2">
              {isEditing && (
                <>
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
                        backgroundColor:
                          addMode === color ? `${BOX_COLORS[color].bg}33` : undefined,
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
              <input
                type="text"
                placeholder="Layout name..."
                value={layoutName}
                onChange={(e) => setLayoutName(e.target.value)}
                className="h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary w-32"
              />
              <button
                type="button"
                onClick={handleSaveLayout}
                disabled={!layoutName.trim() || !gameState}
                className="h-8 px-2 text-xs bg-green-500/20 hover:bg-green-500/30 text-green-500 rounded border border-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none whitespace-nowrap"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Main content - centered */}
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

      {/* Right Sidebar - AI Panel with Error Boundary */}
      <div className="flex-shrink-0 p-4 h-screen flex flex-col">
        <ErrorBoundary fallbackTitle="AI Panel Error" onReset={handleReset}>
          <AIPanel
            state={gameState}
            onMove={handleAIMove}
            onReset={handleReset}
            disabled={!gameState}
            onInferenceTimeChange={setAiInferenceTimeMs}
            isEditing={isEditing}
          />
        </ErrorBoundary>
      </div>
    </div>
  )
}
