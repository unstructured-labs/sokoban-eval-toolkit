import type { Box, CellTerrain, GameState, Position, SokobanLevel } from '@src/types'
import {
  type SavedLayout,
  deleteLayout,
  getSavedLayoutsList,
  layoutExists,
  loadLayout,
  renameLayout,
  reorderLayouts,
  saveLayout,
} from '@src/utils/layoutStorage'
import { useCallback, useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'

interface UseLayoutPersistenceOptions {
  gameState: GameState | null
  onLayoutLoad: (level: SokobanLevel) => void
}

interface UseLayoutPersistenceReturn {
  savedLayouts: SavedLayout[]
  layoutName: string
  setLayoutName: React.Dispatch<React.SetStateAction<string>>
  handleSaveLayout: () => void
  handleLoadLayout: (name: string) => void
  handleDeleteLayout: (name: string) => void
  handleReorderLayouts: (fromIndex: number, toIndex: number) => void
  handleRenameLayout: (oldName: string, newName: string) => boolean
}

export function useLayoutPersistence({
  gameState,
  onLayoutLoad,
}: UseLayoutPersistenceOptions): UseLayoutPersistenceReturn {
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([])
  const [layoutName, setLayoutName] = useState('')

  // Load saved layouts on mount
  useEffect(() => {
    try {
      setSavedLayouts(getSavedLayoutsList())
    } catch (error) {
      console.error('Failed to load saved layouts:', error)
      setSavedLayouts([])
    }
  }, [])

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
    }

    try {
      saveLayout(layout)
      setSavedLayouts(getSavedLayoutsList())
      setLayoutName('')
    } catch (error) {
      console.error('Failed to save layout:', error)
      alert('Failed to save layout. Please try again.')
    }
  }, [gameState, layoutName])

  // Load a saved layout
  const handleLoadLayout = useCallback(
    (name: string) => {
      try {
        const layout = loadLayout(name)
        if (!layout) return

        // Ensure boxes have colors (backward compatibility)
        const boxStarts: Box[] = layout.boxStarts.map((b) => ({
          x: b.x,
          y: b.y,
          color: b.color ?? 'orange',
        }))

        // Create a SokobanLevel from the saved layout
        const level: SokobanLevel = {
          id: `saved-${layout.id}`,
          width: layout.width,
          height: layout.height,
          terrain: layout.terrain as CellTerrain[][],
          playerStart: layout.playerStart,
          boxStarts,
          goals: layout.goals,
          difficulty: layout.difficulty,
          fileSource: 'saved',
          puzzleNumber: 0,
        }

        onLayoutLoad(level)
        setLayoutName(layout.name)
      } catch (error) {
        console.error('Failed to load layout:', error)
        alert('Failed to load layout. The saved data may be corrupted.')
      }
    },
    [onLayoutLoad],
  )

  // Delete a saved layout
  const handleDeleteLayout = useCallback((name: string) => {
    if (!confirm(`Delete layout "${name}"?`)) return

    try {
      deleteLayout(name)
      setSavedLayouts(getSavedLayoutsList())
    } catch (error) {
      console.error('Failed to delete layout:', error)
      alert('Failed to delete layout. Please try again.')
    }
  }, [])

  // Reorder layouts via drag and drop
  const handleReorderLayouts = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return

      try {
        // Create new array with reordered items
        const newLayouts = [...savedLayouts]
        const [removed] = newLayouts.splice(fromIndex, 1)
        if (removed) {
          newLayouts.splice(toIndex, 0, removed)
        }

        // Update state immediately for responsive UI
        setSavedLayouts(newLayouts)

        // Persist the new order
        const orderedNames = newLayouts.map((l) => l.name)
        reorderLayouts(orderedNames)
      } catch (error) {
        console.error('Failed to reorder layouts:', error)
        // Reload from storage on error
        setSavedLayouts(getSavedLayoutsList())
      }
    },
    [savedLayouts],
  )

  // Rename a saved layout
  const handleRenameLayout = useCallback(
    (oldName: string, newName: string): boolean => {
      if (!newName.trim()) {
        alert('Please enter a valid name.')
        return false
      }

      if (layoutExists(newName.trim()) && oldName !== newName.trim()) {
        alert(`A layout named "${newName.trim()}" already exists.`)
        return false
      }

      try {
        const result = renameLayout(oldName, newName.trim())
        if (result) {
          setSavedLayouts(getSavedLayoutsList())
          // If the renamed layout was currently loaded, update the layout name
          if (layoutName === oldName) {
            setLayoutName(newName.trim())
          }
          return true
        }
        return false
      } catch (error) {
        console.error('Failed to rename layout:', error)
        alert('Failed to rename layout. Please try again.')
        return false
      }
    },
    [layoutName],
  )

  return {
    savedLayouts,
    layoutName,
    setLayoutName,
    handleSaveLayout,
    handleLoadLayout,
    handleDeleteLayout,
    handleReorderLayouts,
    handleRenameLayout,
  }
}
