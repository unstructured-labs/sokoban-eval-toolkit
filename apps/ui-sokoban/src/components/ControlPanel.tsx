import { Button } from '@sokoban-eval-toolkit/ui-library/components/button'
import { Separator } from '@sokoban-eval-toolkit/ui-library/components/separator'
import type { GameState, HumanSession } from '@src/types'
import { isSimpleDeadlock } from '@src/utils/gameEngine'
import { type SavedLayout, downloadAllLayouts } from '@src/utils/layoutStorage'
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  GripVertical,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

interface ControlPanelProps {
  state: GameState | null
  // Saved layouts props
  savedLayouts?: SavedLayout[]
  layoutName?: string
  onLayoutNameChange?: (name: string) => void
  onSaveLayout?: () => void
  onLoadLayout?: (name: string) => void
  onDeleteLayout?: (name: string) => void
  onReorderLayouts?: (fromIndex: number, toIndex: number) => void
  onRenameLayout?: (oldName: string, newName: string) => boolean
  selectedLayoutName?: string | null
  onSelectedLayoutChange?: (name: string | null) => void
  // Human session props
  humanSession?: HumanSession | null
  onStartSession?: () => void
  onEndSession?: () => void
}

export function ControlPanel({
  state,
  savedLayouts = [],
  layoutName = '',
  onLayoutNameChange,
  onSaveLayout,
  onLoadLayout,
  onDeleteLayout,
  onReorderLayouts,
  onRenameLayout,
  selectedLayoutName = null,
  onSelectedLayoutChange,
  humanSession,
  onStartSession,
  onEndSession,
}: ControlPanelProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [editingLayoutName, setEditingLayoutName] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')

  // Check if we're editing a loaded layout (name matches selected layout)
  const isEditingLoadedLayout = selectedLayoutName && layoutName === selectedLayoutName

  const hasDeadlock = state ? isSimpleDeadlock(state) : false

  // Session elapsed time with live update
  const [sessionTick, setSessionTick] = useState(0)

  useEffect(() => {
    if (!humanSession?.isActive) return
    const interval = setInterval(() => setSessionTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [humanSession?.isActive])

  const sessionTime = useMemo(() => {
    if (!humanSession) return null
    // Use endTime if session is complete, otherwise use current time
    const endTime = humanSession.isActive ? Date.now() : (humanSession.endTime ?? Date.now())
    void sessionTick // Trigger recalculation on tick (only matters when active)
    const ms = endTime - humanSession.startTime
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }, [humanSession, sessionTick])

  return (
    <div className="space-y-3">
      <Separator />

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Game Stats
        </span>
      </div>

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

      {/* Human Session */}
      {onStartSession && onEndSession && (
        <>
          {/* Session stats - show when session exists (active or completed) */}
          {humanSession && (
            <div
              className={`rounded-md px-3 py-2 space-y-1 ${
                humanSession.isActive
                  ? 'bg-primary/10 border border-primary/30'
                  : 'bg-green-500/10 border border-green-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {humanSession.isActive ? 'Session Active' : 'Session Complete'}
                </span>
                <span
                  className={`text-xs font-mono ${humanSession.isActive ? 'text-primary' : 'text-green-500'}`}
                >
                  {sessionTime}
                </span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Steps: </span>
                <span className="font-semibold tabular-nums">{humanSession.totalSteps}</span>
                {!humanSession.isActive && humanSession.restarts > 0 && (
                  <>
                    <span className="text-muted-foreground ml-2">Restarts: </span>
                    <span className="font-semibold tabular-nums">{humanSession.restarts}</span>
                  </>
                )}
              </div>
            </div>
          )}
          {/* Button - End Session when active, Start Session otherwise */}
          {humanSession?.isActive ? (
            <Button
              onClick={onEndSession}
              size="sm"
              variant="secondary"
              className="w-full h-8 text-xs"
            >
              End Session
            </Button>
          ) : (
            <Button
              onClick={onStartSession}
              disabled={!state}
              size="sm"
              variant="secondary"
              className="w-full h-8 text-xs"
            >
              Start Session
            </Button>
          )}
        </>
      )}

      {/* Saved Layouts section */}
      {onSaveLayout && onLoadLayout && onDeleteLayout && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Saved Layouts
              </span>
              {/* Navigation controls */}
              {selectedLayoutName && savedLayouts.length > 1 && (
                <div className="flex items-center gap-0.5">
                  <Button
                    onClick={() => {
                      const currentIndex = savedLayouts.findIndex(
                        (l) => l.name === selectedLayoutName,
                      )
                      if (currentIndex > 0) {
                        const prevLayout = savedLayouts[currentIndex - 1]
                        if (prevLayout) {
                          onLoadLayout(prevLayout.name)
                          onSelectedLayoutChange?.(prevLayout.name)
                        }
                      }
                    }}
                    disabled={savedLayouts.findIndex((l) => l.name === selectedLayoutName) === 0}
                    size="sm"
                    variant="secondary"
                    className="h-5 px-1"
                    title="Previous layout"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </Button>
                  <Button
                    onClick={() => {
                      const currentIndex = savedLayouts.findIndex(
                        (l) => l.name === selectedLayoutName,
                      )
                      if (currentIndex < savedLayouts.length - 1) {
                        const nextLayout = savedLayouts[currentIndex + 1]
                        if (nextLayout) {
                          onLoadLayout(nextLayout.name)
                          onSelectedLayoutChange?.(nextLayout.name)
                        }
                      }
                    }}
                    disabled={
                      savedLayouts.findIndex((l) => l.name === selectedLayoutName) ===
                      savedLayouts.length - 1
                    }
                    size="sm"
                    variant="secondary"
                    className="h-5 px-1"
                    title="Next layout"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Currently editing indicator */}
            {isEditingLoadedLayout && (
              <div className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                Editing: <span className="font-medium text-foreground">{selectedLayoutName}</span>
              </div>
            )}

            {/* Save input and button */}
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Layout name..."
                value={layoutName}
                onChange={(e) => onLayoutNameChange?.(e.target.value)}
                className="flex-1 h-7 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button
                onClick={onSaveLayout}
                disabled={!layoutName.trim() || !state}
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-xs"
              >
                {isEditingLoadedLayout ? 'Update' : 'Save'}
              </Button>
            </div>

            {/* Saved layouts list */}
            {/* Export All button */}
            {savedLayouts.length > 0 && (
              <Button
                onClick={downloadAllLayouts}
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs gap-1.5"
              >
                <Download className="w-3 h-3" />
                Export All ({savedLayouts.length})
              </Button>
            )}

            {savedLayouts.length > 0 ? (
              <div className="space-y-1">
                {savedLayouts.map((layout, index) => {
                  const isSelected = selectedLayoutName === layout.name
                  const isDragging = draggedIndex === index
                  const isDragOver = dragOverIndex === index && draggedIndex !== index
                  const isEditing = editingLayoutName === layout.name

                  // Inline rename mode
                  if (isEditing) {
                    return (
                      <div
                        key={layout.id}
                        className="flex items-center gap-1 px-1.5 py-1.5 rounded-md bg-primary/10 ring-1 ring-primary/30"
                      >
                        <input
                          ref={(el) => el?.focus()}
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const success = onRenameLayout?.(layout.name, editingValue)
                              if (success) {
                                if (isSelected) {
                                  onSelectedLayoutChange?.(editingValue)
                                }
                                setEditingLayoutName(null)
                              }
                            } else if (e.key === 'Escape') {
                              setEditingLayoutName(null)
                            }
                          }}
                          className="flex-1 h-5 px-1.5 text-[11px] bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const success = onRenameLayout?.(layout.name, editingValue)
                            if (success) {
                              if (isSelected) {
                                onSelectedLayoutChange?.(editingValue)
                              }
                              setEditingLayoutName(null)
                            }
                          }}
                          className="p-1 text-green-500 hover:bg-green-500/10 rounded"
                          title="Save name"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingLayoutName(null)}
                          className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={layout.id}
                      draggable={!!onReorderLayouts}
                      onDragStart={(e) => {
                        setDraggedIndex(index)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => {
                        if (draggedIndex !== null && dragOverIndex !== null) {
                          onReorderLayouts?.(draggedIndex, dragOverIndex)
                        }
                        setDraggedIndex(null)
                        setDragOverIndex(null)
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                      }}
                      onDragEnter={() => setDragOverIndex(index)}
                      className={`group flex items-center gap-1 px-1.5 py-1.5 rounded-md transition-colors ${
                        isSelected
                          ? 'bg-primary/15 ring-1 ring-primary/30'
                          : 'bg-muted/40 hover:bg-muted/70'
                      } ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'ring-2 ring-primary/50' : ''}`}
                    >
                      {onReorderLayouts && (
                        <div className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground flex-shrink-0">
                          <GripVertical className="w-3 h-3" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onLoadLayout(layout.name)
                          onSelectedLayoutChange?.(layout.name)
                        }}
                        className={`flex-1 min-w-0 text-left flex items-center gap-2 text-[11px] focus:outline-none ${
                          isSelected ? 'text-primary font-medium' : 'text-foreground'
                        }`}
                      >
                        <span className="truncate">{layout.name}</span>
                        <span className="text-muted-foreground flex-shrink-0">
                          {layout.width}×{layout.height}
                        </span>
                        <span className="text-muted-foreground flex-shrink-0">
                          {layout.boxStarts.length} box{layout.boxStarts.length !== 1 ? 'es' : ''}
                        </span>
                      </button>
                      {onRenameLayout && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLayoutName(layout.name)
                            setEditingValue(layout.name)
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary rounded transition-all hover:bg-primary/10 flex-shrink-0"
                          title="Rename layout"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteLayout(layout.name)
                          if (isSelected) {
                            onSelectedLayoutChange?.(null)
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 rounded transition-all hover:bg-red-500/10 flex-shrink-0"
                        title="Delete layout"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground italic py-2">
                No saved layouts yet
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
