import type { Box, CellTerrain, Difficulty, Position } from '@src/types'
import { v4 as uuidv4 } from 'uuid'

const LAYOUTS_STORAGE_KEY = 'sokoban_layouts'

export interface SavedLayout {
  id: string
  name: string
  savedAt: number
  order?: number
  difficulty: Difficulty
  width: number
  height: number
  terrain: CellTerrain[][]
  playerStart: Position
  boxStarts: Box[]
  goals: Position[]
}

/**
 * Get all saved layouts as an object keyed by name.
 */
export function getSavedLayouts(): Record<string, SavedLayout> {
  if (typeof window === 'undefined') return {}
  const saved = localStorage.getItem(LAYOUTS_STORAGE_KEY)
  return saved ? JSON.parse(saved) : {}
}

/**
 * Get saved layouts as a sorted array (by order, then newest first).
 */
export function getSavedLayoutsList(): SavedLayout[] {
  const layouts = getSavedLayouts()
  return Object.values(layouts).sort((a, b) => {
    // Sort by order if both have it, otherwise by savedAt (newest first)
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order
    }
    return b.savedAt - a.savedAt
  })
}

/**
 * Save a layout to localStorage.
 * Generates a persistent UUID if one doesn't exist.
 */
export function saveLayout(layout: SavedLayout): SavedLayout {
  if (typeof window === 'undefined') return layout
  const layouts = getSavedLayouts()

  // Preserve existing ID or generate new one
  const existingLayout = layouts[layout.name]
  const savedLayout: SavedLayout = {
    ...layout,
    id: layout.id || existingLayout?.id || uuidv4(),
  }

  layouts[layout.name] = savedLayout
  localStorage.setItem(LAYOUTS_STORAGE_KEY, JSON.stringify(layouts))
  return savedLayout
}

/**
 * Load a layout by name.
 */
export function loadLayout(name: string): SavedLayout | null {
  const layouts = getSavedLayouts()
  return layouts[name] ?? null
}

/**
 * Delete a layout by name.
 */
export function deleteLayout(name: string): void {
  if (typeof window === 'undefined') return
  const layouts = getSavedLayouts()
  delete layouts[name]
  localStorage.setItem(LAYOUTS_STORAGE_KEY, JSON.stringify(layouts))
}

/**
 * Check if a layout with the given name exists.
 */
export function layoutExists(name: string): boolean {
  const layouts = getSavedLayouts()
  return name in layouts
}

/**
 * Reorder layouts by providing an array of names in the desired order.
 */
export function reorderLayouts(orderedNames: string[]): void {
  if (typeof window === 'undefined') return
  const layouts = getSavedLayouts()

  // Update order field for each layout
  orderedNames.forEach((name, index) => {
    if (layouts[name]) {
      layouts[name].order = index
    }
  })

  localStorage.setItem(LAYOUTS_STORAGE_KEY, JSON.stringify(layouts))
}
