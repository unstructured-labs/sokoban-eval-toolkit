import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@sokoban-eval-toolkit/ui-library/components/card'
import { MOVE_KEYS } from '@src/constants'
import type { CellTerrain, GameState, MoveDirection, Position, SokobanLevel } from '@src/types'
import { generateEasyCustomLevel } from '@src/utils/easyCustomGenerator'
import {
  executeMove,
  getBoxesOnGoalsCount,
  initializeGame,
  resetGame,
  undoMove,
} from '@src/utils/gameEngine'
import {
  type SavedLayout,
  deleteLayout,
  getSavedLayoutsList,
  layoutExists,
  loadLayout,
  saveLayout,
} from '@src/utils/layoutStorage'
import { generateLevel } from '@src/utils/levelGenerator'
import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { AIPanel } from './components/AIPanel'
import { ControlPanel } from './components/ControlPanel'
import { LevelSelector } from './components/LevelSelector'
import { SavedLayoutsOverlay } from './components/SavedLayoutsOverlay'
import { SokobanGrid } from './components/SokobanGrid'

export function SokobanGame() {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [currentLevel, setCurrentLevel] = useState<SokobanLevel | null>(null)
  const [aiInferenceTimeMs, setAiInferenceTimeMs] = useState<number | null>(null)
  const initialLoadDone = useRef(false)
  const [isPlayingSolution, setIsPlayingSolution] = useState(false)
  const [isEditing, setIsEditing] = useState(true)
  const [isVariantRules, setIsVariantRules] = useState(false)
  const [isCustomPushingRules, setIsCustomPushingRules] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState<{
    type: 'player' | 'box' | 'goal' | 'player-goal'
    index?: number
    x: number
    y: number
  } | null>(null)
  const [isDraggingWalls, setIsDraggingWalls] = useState(false)
  const [addMode, setAddMode] = useState<'goal' | 'box' | 'player-goal' | 'remove' | null>(null)
  const solutionMovesRef = useRef<MoveDirection[]>([])
  const solutionIndexRef = useRef(0)
  const solutionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Saved layouts state
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([])
  const [layoutName, setLayoutName] = useState('')

  // Load saved layouts on mount
  useEffect(() => {
    setSavedLayouts(getSavedLayoutsList())
  }, [])

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
      if (!gameState || gameState.isWon || gameState.isLost) return false

      const newState = executeMove(
        gameState,
        direction,
        'human',
        isVariantRules,
        isCustomPushingRules,
      )
      if (newState) {
        setGameState(newState)
        return true
      }
      return false
    },
    [gameState, isVariantRules, isCustomPushingRules],
  )

  // Handle AI move (returns true if valid)
  const handleAIMove = useCallback(
    (direction: MoveDirection): boolean => {
      if (!gameState || gameState.isWon || gameState.isLost) return false

      const newState = executeMove(gameState, direction, 'ai', isVariantRules, isCustomPushingRules)
      if (newState) {
        setGameState(newState)
        return true
      }
      return false
    },
    [gameState, isVariantRules, isCustomPushingRules],
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
    if (index >= moves.length || gameState.isWon || gameState.isLost) {
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
      const newState = executeMove(gameState, direction, 'ai', isVariantRules, isCustomPushingRules)
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
  }, [isPlayingSolution, gameState, isVariantRules, isCustomPushingRules])

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
    if (difficulty === 'easy-custom') {
      const newLevel = generateEasyCustomLevel()
      handleLevelLoad(newLevel)
    } else if (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') {
      const newLevel = generateLevel(difficulty)
      handleLevelLoad(newLevel)
    }
  }, [currentLevel, handleLevelLoad])

  // Save current layout
  const handleSaveLayout = useCallback(() => {
    if (!gameState || !layoutName.trim()) return

    // Check for duplicate
    if (layoutExists(layoutName.trim())) {
      if (!confirm(`A layout named "${layoutName.trim()}" already exists. Overwrite?`)) {
        return
      }
    }

    // Extract goals from terrain
    const goals: Position[] = []
    gameState.level.terrain.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell === 'goal') {
          goals.push({ x, y })
        }
      })
    })

    const layout: SavedLayout = {
      id: uuidv4(),
      name: layoutName.trim(),
      savedAt: Date.now(),
      difficulty: gameState.level.difficulty,
      width: gameState.level.width,
      height: gameState.level.height,
      terrain: gameState.level.terrain,
      playerStart: gameState.playerPos,
      boxStarts: gameState.boxes,
      goals,
      playerGoal: gameState.level.playerGoal,
    }

    saveLayout(layout)
    setSavedLayouts(getSavedLayoutsList())
    setLayoutName('')
  }, [gameState, layoutName])

  // Load a saved layout
  const handleLoadLayout = useCallback(
    (name: string) => {
      const layout = loadLayout(name)
      if (!layout) return

      // Create a SokobanLevel from the saved layout
      const level: SokobanLevel = {
        id: `saved-${layout.id}`,
        width: layout.width,
        height: layout.height,
        terrain: layout.terrain as CellTerrain[][],
        playerStart: layout.playerStart,
        boxStarts: layout.boxStarts,
        goals: layout.goals,
        playerGoal: layout.playerGoal,
        difficulty: layout.difficulty,
        fileSource: 'saved',
        puzzleNumber: 0,
      }

      handleLevelLoad(level)
      setLayoutName(layout.name)
    },
    [handleLevelLoad],
  )

  // Delete a saved layout
  const handleDeleteLayout = useCallback((name: string) => {
    if (!confirm(`Delete layout "${name}"?`)) return
    deleteLayout(name)
    setSavedLayouts(getSavedLayoutsList())
  }, [])

  // Flip a cell's terrain state (wall <-> floor)
  const flipCell = useCallback(
    (x: number, y: number) => {
      if (!gameState) return

      // Don't allow editing border walls
      if (
        x === 0 ||
        x === gameState.level.width - 1 ||
        y === 0 ||
        y === gameState.level.height - 1
      ) {
        return
      }

      const currentTerrain = gameState.level.terrain[y]?.[x]
      if (currentTerrain === undefined || currentTerrain === 'goal') return

      const newMode = currentTerrain === 'wall' ? 'floor' : 'wall'

      const newTerrainGrid = gameState.level.terrain.map((row, rowY) =>
        rowY === y ? row.map((cell, cellX) => (cellX === x ? newMode : cell)) : row,
      )

      const newLevel = {
        ...gameState.level,
        terrain: newTerrainGrid,
      }

      setGameState({
        ...gameState,
        level: newLevel,
      })
      setCurrentLevel(newLevel)
    },
    [gameState],
  )

  // Start drag painting
  const handleCellDragStart = useCallback(
    (x: number, y: number) => {
      if (!gameState || !isEditing) return

      // If an entity is selected, don't start wall dragging - let click handler move the entity
      if (selectedEntity) return

      // If add mode is active, don't start wall dragging - let click handler place the entity
      if (addMode) return

      // Don't allow editing border walls
      if (
        x === 0 ||
        x === gameState.level.width - 1 ||
        y === 0 ||
        y === gameState.level.height - 1
      ) {
        return
      }

      setIsDraggingWalls(true)

      // Flip the starting cell
      flipCell(x, y)
    },
    [gameState, isEditing, flipCell, selectedEntity, addMode],
  )

  // Continue drag painting - flip each cell as we enter it
  const handleCellDragEnter = useCallback(
    (x: number, y: number) => {
      if (!isDraggingWalls) return
      flipCell(x, y)
    },
    [isDraggingWalls, flipCell],
  )

  // End drag painting
  const handleDragEnd = useCallback(() => {
    setIsDraggingWalls(false)
  }, [])

  // Global mouse up listener to end drag even if mouse leaves the grid
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingWalls) {
        handleDragEnd()
      }
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [isDraggingWalls, handleDragEnd])

  // Flip board 180 degrees
  const handleFlipBoard = useCallback(() => {
    if (!gameState) return

    const { level, playerPos, boxes } = gameState
    const { width, height } = level

    // Flip terrain (reverse rows and columns)
    const newTerrain: CellTerrain[][] = []
    for (let y = height - 1; y >= 0; y--) {
      const newRow: CellTerrain[] = []
      for (let x = width - 1; x >= 0; x--) {
        newRow.push(level.terrain[y]?.[x] || 'floor')
      }
      newTerrain.push(newRow)
    }

    // Transform position helper
    const flipPos = (pos: Position): Position => ({
      x: width - 1 - pos.x,
      y: height - 1 - pos.y,
    })

    // Transform all positions
    const newPlayerPos = flipPos(playerPos)
    const newBoxes = boxes.map(flipPos)
    const newGoals = level.goals.map(flipPos)
    const newPlayerStart = flipPos(level.playerStart)
    const newBoxStarts = level.boxStarts.map(flipPos)

    const newLevel: SokobanLevel = {
      ...level,
      terrain: newTerrain,
      playerStart: newPlayerStart,
      boxStarts: newBoxStarts,
      goals: newGoals,
    }

    setGameState({
      ...gameState,
      level: newLevel,
      playerPos: newPlayerPos,
      boxes: newBoxes,
    })
    setCurrentLevel(newLevel)
  }, [gameState])

  // Rotate board 90 degrees clockwise
  const handleRotateBoard = useCallback(() => {
    if (!gameState) return

    const { level, playerPos, boxes } = gameState
    const { width, height } = level

    // Rotate terrain 90 degrees clockwise
    // New width = old height, new height = old width
    const newWidth = height
    const newHeight = width
    const newTerrain: CellTerrain[][] = []

    for (let newY = 0; newY < newHeight; newY++) {
      const newRow: CellTerrain[] = []
      for (let newX = 0; newX < newWidth; newX++) {
        // For clockwise rotation: new(x,y) = old(height-1-y, x)
        const oldX = newY
        const oldY = height - 1 - newX
        newRow.push(level.terrain[oldY]?.[oldX] || 'floor')
      }
      newTerrain.push(newRow)
    }

    // Transform position helper (clockwise: new(x,y) = (height-1-oldY, oldX))
    const rotatePos = (pos: Position): Position => ({
      x: height - 1 - pos.y,
      y: pos.x,
    })

    // Transform all positions
    const newPlayerPos = rotatePos(playerPos)
    const newBoxes = boxes.map(rotatePos)
    const newGoals = level.goals.map(rotatePos)
    const newPlayerStart = rotatePos(level.playerStart)
    const newBoxStarts = level.boxStarts.map(rotatePos)

    const newLevel: SokobanLevel = {
      ...level,
      width: newWidth,
      height: newHeight,
      terrain: newTerrain,
      playerStart: newPlayerStart,
      boxStarts: newBoxStarts,
      goals: newGoals,
    }

    setGameState({
      ...gameState,
      level: newLevel,
      playerPos: newPlayerPos,
      boxes: newBoxes,
    })
    setCurrentLevel(newLevel)
  }, [gameState])

  // Handle cell click for editing mode
  const handleCellClick = useCallback(
    (x: number, y: number) => {
      if (!gameState || !isEditing) return

      const currentTerrain = gameState.level.terrain[y]?.[x]
      if (currentTerrain === undefined) return

      // Check what's at this cell
      const isPlayerHere = gameState.playerPos.x === x && gameState.playerPos.y === y
      const boxIndex = gameState.boxes.findIndex((b) => b.x === x && b.y === y)
      const isBoxHere = boxIndex !== -1
      const isGoalHere = currentTerrain === 'goal'
      const isWall = currentTerrain === 'wall'
      const isPlayerGoalHere =
        gameState.level.playerGoal?.x === x && gameState.level.playerGoal?.y === y

      // Handle add mode
      if (addMode) {
        // Handle remove mode separately (can work on any cell with removable content)
        if (addMode === 'remove') {
          // Remove box if present
          if (isBoxHere) {
            const newBoxes = gameState.boxes.filter((b) => !(b.x === x && b.y === y))
            const newLevel = {
              ...gameState.level,
              boxStarts: newBoxes,
            }
            setGameState({
              ...gameState,
              boxes: newBoxes,
              level: newLevel,
            })
            setCurrentLevel(newLevel)
            return
          }

          // Remove goal if present
          if (isGoalHere) {
            const newTerrainGrid = gameState.level.terrain.map((row, rowY) =>
              rowY === y ? row.map((cell, cellX) => (cellX === x ? 'floor' : cell)) : row,
            )
            const newLevel = {
              ...gameState.level,
              terrain: newTerrainGrid,
            }
            setGameState({
              ...gameState,
              level: newLevel,
            })
            setCurrentLevel(newLevel)
            return
          }

          // Remove player goal if present
          if (isPlayerGoalHere) {
            const newLevel = {
              ...gameState.level,
              playerGoal: undefined,
            }
            setGameState({
              ...gameState,
              level: newLevel,
            })
            setCurrentLevel(newLevel)
            return
          }

          return
        }

        // Can't add on border cells
        if (
          x === 0 ||
          x === gameState.level.width - 1 ||
          y === 0 ||
          y === gameState.level.height - 1
        ) {
          return
        }

        // Can't add on walls
        if (isWall) return

        if (addMode === 'goal') {
          // Can't add goal where one already exists
          if (isGoalHere) return

          // Add goal by setting terrain to 'goal'
          const newTerrainGrid = gameState.level.terrain.map((row, rowY) =>
            rowY === y ? row.map((cell, cellX) => (cellX === x ? 'goal' : cell)) : row,
          )

          const newLevel = {
            ...gameState.level,
            terrain: newTerrainGrid,
          }

          setGameState({
            ...gameState,
            level: newLevel,
          })
          setCurrentLevel(newLevel)
        } else if (addMode === 'box') {
          // Can't add box where player or another box exists
          if (isPlayerHere || isBoxHere) return

          // Add box to the array
          const newBoxes = [...gameState.boxes, { x, y }]
          const newLevel = {
            ...gameState.level,
            boxStarts: newBoxes,
          }

          setGameState({
            ...gameState,
            boxes: newBoxes,
            level: newLevel,
          })
          setCurrentLevel(newLevel)
        } else if (addMode === 'player-goal') {
          // Can't add player goal where one already exists
          if (isPlayerGoalHere) return

          // Set player goal (replaces any existing one since there can only be one)
          const newLevel = {
            ...gameState.level,
            playerGoal: { x, y },
          }

          setGameState({
            ...gameState,
            level: newLevel,
          })
          setCurrentLevel(newLevel)
        }

        return
      }

      // If clicking on player, box, goal, or player-goal - handle selection
      if (
        isPlayerHere ||
        isBoxHere ||
        (isGoalHere && !isPlayerHere && !isBoxHere) ||
        (isPlayerGoalHere && !isPlayerHere)
      ) {
        // Determine what we clicked on (priority: player > box > goal > player-goal)
        let clickedType: 'player' | 'box' | 'goal' | 'player-goal'
        let clickedIndex: number | undefined

        if (isPlayerHere) {
          clickedType = 'player'
        } else if (isBoxHere) {
          clickedType = 'box'
          clickedIndex = boxIndex
        } else if (isGoalHere) {
          clickedType = 'goal'
        } else {
          clickedType = 'player-goal'
        }

        // If same entity is already selected, deselect it
        if (
          selectedEntity &&
          selectedEntity.type === clickedType &&
          selectedEntity.x === x &&
          selectedEntity.y === y
        ) {
          setSelectedEntity(null)
          return
        }

        // Select this entity
        setSelectedEntity({ type: clickedType, index: clickedIndex, x, y })
        return
      }

      // If something is selected and clicking on a valid destination
      if (selectedEntity) {
        // Don't allow placing on border
        if (
          x === 0 ||
          x === gameState.level.width - 1 ||
          y === 0 ||
          y === gameState.level.height - 1
        ) {
          return
        }

        // Can't place on walls
        if (isWall) {
          return
        }

        // Can't place on occupied cells (player or box already there)
        if (isPlayerHere || isBoxHere) {
          return
        }

        // Move the selected entity and update level initial positions
        if (selectedEntity.type === 'player') {
          const newLevel = {
            ...gameState.level,
            playerStart: { x, y },
          }
          setGameState({
            ...gameState,
            playerPos: { x, y },
            level: newLevel,
          })
          setCurrentLevel(newLevel)
        } else if (selectedEntity.type === 'box' && selectedEntity.index !== undefined) {
          const newBoxes = [...gameState.boxes]
          newBoxes[selectedEntity.index] = { x, y }
          const newLevel = {
            ...gameState.level,
            boxStarts: newBoxes,
          }
          setGameState({
            ...gameState,
            boxes: newBoxes,
            level: newLevel,
          })
          setCurrentLevel(newLevel)
        } else if (selectedEntity.type === 'goal') {
          // Move goal: remove from old position, add to new position
          const newTerrainGrid = gameState.level.terrain.map((row, rowY) =>
            row.map((cell, cellX) => {
              if (cellX === selectedEntity.x && rowY === selectedEntity.y) {
                return 'floor' // Remove goal from old position
              }
              if (cellX === x && rowY === y) {
                return 'goal' // Add goal to new position
              }
              return cell
            }),
          )

          const newLevel = {
            ...gameState.level,
            terrain: newTerrainGrid,
          }

          setGameState({
            ...gameState,
            level: newLevel,
          })
          setCurrentLevel(newLevel)
        } else if (selectedEntity.type === 'player-goal') {
          // Move player goal to new position
          const newLevel = {
            ...gameState.level,
            playerGoal: { x, y },
          }

          setGameState({
            ...gameState,
            level: newLevel,
          })
          setCurrentLevel(newLevel)
        }

        // Clear selection after moving
        setSelectedEntity(null)
        return
      }

      // Wall toggling is handled by drag handler (handleCellDragStart)
      // so we don't need to handle it here
    },
    [gameState, isEditing, selectedEntity, addMode],
  )

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
            <LevelSelector
              onLevelLoad={handleLevelLoad}
              disabled={false}
              currentLevel={currentLevel}
              isEditing={isEditing}
              onEditingChange={setIsEditing}
              isVariantRules={isVariantRules}
              onVariantRulesChange={setIsVariantRules}
              isCustomPushingRules={isCustomPushingRules}
              onCustomPushingRulesChange={setIsCustomPushingRules}
              onFlipBoard={handleFlipBoard}
              onRotateBoard={handleRotateBoard}
            />
            <ControlPanel
              state={gameState}
              onUndo={handleUndo}
              onReset={handleReset}
              disabled={false}
              aiInferenceTimeMs={aiInferenceTimeMs}
              onRunSolution={handleRunSolution}
              isPlayingSolution={isPlayingSolution}
              isVariantRules={isVariantRules}
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
                    onClick={() => setAddMode(addMode === 'goal' ? null : 'goal')}
                    className={`h-8 px-2 text-xs rounded border focus:outline-none whitespace-nowrap ${
                      addMode === 'goal'
                        ? 'bg-[hsl(var(--sokoban-goal))]/20 text-[hsl(var(--sokoban-goal))] border-[hsl(var(--sokoban-goal))]/50'
                        : 'bg-muted/50 hover:bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    + {isVariantRules ? 'Trap' : 'Goal'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode(addMode === 'box' ? null : 'box')}
                    className={`h-8 px-2 text-xs rounded border focus:outline-none whitespace-nowrap ${
                      addMode === 'box'
                        ? 'bg-[hsl(var(--sokoban-box))]/20 text-[hsl(var(--sokoban-box))] border-[hsl(var(--sokoban-box))]/50'
                        : 'bg-muted/50 hover:bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    + Box
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode(addMode === 'player-goal' ? null : 'player-goal')}
                    className={`h-8 px-2 text-xs rounded border focus:outline-none whitespace-nowrap ${
                      addMode === 'player-goal'
                        ? 'bg-[hsl(var(--sokoban-player-goal))]/20 text-[hsl(var(--sokoban-player-goal))] border-[hsl(var(--sokoban-player-goal))]/50'
                        : 'bg-muted/50 hover:bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    + Player Goal
                  </button>
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

          {/* Loss message (variant mode) */}
          {gameState?.isLost && (
            <div className="text-red-500 mb-2 animate-pulse font-medium">
              Stepped on a Trap! Press R to restart.
            </div>
          )}

          {/* Progress */}
          {gameState && !gameState.isWon && !gameState.isLost && (
            <div className="text-xs text-muted-foreground mb-3">
              {isVariantRules ? (
                <>
                  Traps: {gameState.neutralizedTraps.length}/{currentLevel?.goals.length ?? 0}{' '}
                  neutralized | Boxes: {gameState.boxes.length}
                </>
              ) : (
                <>
                  Progress: {boxesOnGoals}/{totalBoxes} boxes on goals
                </>
              )}
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
              <span>{isVariantRules ? 'Trap' : 'Goal'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 flex items-center justify-center text-[hsl(var(--sokoban-player-goal))]"
                style={{ fontSize: '10px' }}
              >
                ★
              </div>
              <span>Player Goal</span>
            </div>
          </div>

          {/* Completion stats */}
          {gameState?.isWon && (
            <div className="mt-3 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2 text-center">
              <div className="text-green-500 font-medium text-sm">
                Completed in {gameState.moveHistory.length} moves
                {currentLevel?.optimalMoves && !isVariantRules && (
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

          {/* Variant mode info */}
          {isVariantRules && (
            <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-md px-4 py-2 text-[11px] text-amber-600 dark:text-amber-400 max-w-xs">
              <div className="font-medium mb-1 text-center">Variant Mode Active</div>
              <ul className="space-y-0.5 text-amber-500/80">
                <li>• Goals become traps (deadly to player)</li>
                <li>• Push boxes onto traps to neutralize them</li>
                <li>• Reach the Player Goal to win</li>
              </ul>
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
          isVariantRules={isVariantRules}
          isCustomPushingRules={isCustomPushingRules}
        />
      </div>
    </div>
  )
}
