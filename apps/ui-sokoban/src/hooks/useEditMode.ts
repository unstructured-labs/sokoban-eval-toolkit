import type { Box, BoxColor, CellTerrain, GameState, Position, SokobanLevel } from '@src/types'
import { useCallback, useEffect, useState } from 'react'

export type AddMode = 'goal' | 'box' | BoxColor | 'wall' | 'remove' | null

export interface SelectedEntity {
  type: 'player' | 'box' | 'goal'
  index?: number
  x: number
  y: number
}

interface UseEditModeOptions {
  gameState: GameState | null
  setGameState: React.Dispatch<React.SetStateAction<GameState | null>>
  setCurrentLevel: React.Dispatch<React.SetStateAction<SokobanLevel | null>>
  isEditing: boolean
}

interface UseEditModeReturn {
  selectedEntity: SelectedEntity | null
  setSelectedEntity: React.Dispatch<React.SetStateAction<SelectedEntity | null>>
  isDraggingWalls: boolean
  addMode: AddMode
  setAddMode: React.Dispatch<React.SetStateAction<AddMode>>
  handleCellClick: (x: number, y: number) => void
  handleCellDragStart: (x: number, y: number) => void
  handleCellDragEnter: (x: number, y: number) => void
  handleDragEnd: () => void
}

export function useEditMode({
  gameState,
  setGameState,
  setCurrentLevel,
  isEditing,
}: UseEditModeOptions): UseEditModeReturn {
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null)
  const [isDraggingWalls, setIsDraggingWalls] = useState(false)
  const [addMode, setAddMode] = useState<AddMode>(null)

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
    [gameState, setGameState, setCurrentLevel],
  )

  // Start drag painting
  const handleCellDragStart = useCallback(
    (x: number, y: number) => {
      if (!gameState || !isEditing) return

      // If an entity is selected, don't start wall dragging
      if (selectedEntity) return

      // If add mode is active (except wall mode), don't start wall dragging
      if (addMode && addMode !== 'wall') return

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
      flipCell(x, y)
    },
    [gameState, isEditing, flipCell, selectedEntity, addMode],
  )

  // Continue drag painting
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

  // Global mouse up listener
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingWalls) {
        handleDragEnd()
      }
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [isDraggingWalls, handleDragEnd])

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

      // Handle add mode
      if (addMode) {
        // Handle remove mode separately
        if (addMode === 'remove') {
          // Don't allow removing border walls
          const isBorder =
            x === 0 ||
            x === gameState.level.width - 1 ||
            y === 0 ||
            y === gameState.level.height - 1

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

          if (isGoalHere) {
            const newTerrainGrid = gameState.level.terrain.map((row, rowY) =>
              rowY === y
                ? row.map((cell, cellX) => (cellX === x ? ('floor' as CellTerrain) : cell))
                : row,
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

          // Remove walls (convert to floor)
          if (isWall && !isBorder) {
            const newTerrainGrid = gameState.level.terrain.map((row, rowY) =>
              rowY === y
                ? row.map((cell, cellX) => (cellX === x ? ('floor' as CellTerrain) : cell))
                : row,
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

          return
        }

        // Wall mode is handled by drag handlers
        if (addMode === 'wall') {
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
          if (isGoalHere) return

          const newTerrainGrid = gameState.level.terrain.map((row, rowY) =>
            rowY === y
              ? row.map((cell, cellX) => (cellX === x ? ('goal' as CellTerrain) : cell))
              : row,
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
        } else if (
          addMode === 'box' ||
          addMode === 'orange' ||
          addMode === 'purple' ||
          addMode === 'emerald' ||
          addMode === 'sky'
        ) {
          if (isPlayerHere || isBoxHere) return

          const boxColor: BoxColor = addMode === 'box' ? 'orange' : addMode

          const newBox: Box = { x, y, color: boxColor }
          const newBoxes = [...gameState.boxes, newBox]
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
        }

        return
      }

      // If clicking on player, box, or goal - handle selection
      if (isPlayerHere || isBoxHere || (isGoalHere && !isPlayerHere && !isBoxHere)) {
        let clickedType: 'player' | 'box' | 'goal'
        let clickedIndex: number | undefined

        if (isPlayerHere) {
          clickedType = 'player'
        } else if (isBoxHere) {
          clickedType = 'box'
          clickedIndex = boxIndex
        } else {
          clickedType = 'goal'
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

        // Can't place on occupied cells
        if (isPlayerHere || isBoxHere) {
          return
        }

        // Move the selected entity
        if (selectedEntity.type === 'player') {
          const newLevel = {
            ...gameState.level,
            playerStart: { x, y } as Position,
          }
          setGameState({
            ...gameState,
            playerPos: { x, y },
            level: newLevel,
          })
          setCurrentLevel(newLevel)
        } else if (selectedEntity.type === 'box' && selectedEntity.index !== undefined) {
          const newBoxes = [...gameState.boxes]
          const existingBox = newBoxes[selectedEntity.index]
          newBoxes[selectedEntity.index] = { x, y, color: existingBox?.color ?? 'orange' }
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
          const newTerrainGrid = gameState.level.terrain.map((row, rowY) =>
            row.map((cell, cellX) => {
              if (cellX === selectedEntity.x && rowY === selectedEntity.y) {
                return 'floor' as CellTerrain
              }
              if (cellX === x && rowY === y) {
                return 'goal' as CellTerrain
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
        }

        setSelectedEntity(null)
        return
      }
    },
    [gameState, isEditing, selectedEntity, addMode, setGameState, setCurrentLevel],
  )

  return {
    selectedEntity,
    setSelectedEntity,
    isDraggingWalls,
    addMode,
    setAddMode,
    handleCellClick,
    handleCellDragStart,
    handleCellDragEnter,
    handleDragEnd,
  }
}
