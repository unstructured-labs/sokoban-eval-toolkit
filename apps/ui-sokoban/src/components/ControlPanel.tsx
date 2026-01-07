import { Button } from '@sokoban-eval-toolkit/ui-library/components/button'
import { Separator } from '@sokoban-eval-toolkit/ui-library/components/separator'
import type { GameState } from '@src/types'
import { isSimpleDeadlock } from '@src/utils/gameEngine'
import type { SavedLayout } from '@src/utils/layoutStorage'
import { AlertTriangle, ChevronLeft, ChevronRight, GripVertical, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

interface ControlPanelProps {
  state: GameState | null
  aiInferenceTimeMs?: number | null
  // Saved layouts props
  savedLayouts?: SavedLayout[]
  layoutName?: string
  onLayoutNameChange?: (name: string) => void
  onSaveLayout?: () => void
  onLoadLayout?: (name: string) => void
  onDeleteLayout?: (name: string) => void
  onReorderLayouts?: (fromIndex: number, toIndex: number) => void
  selectedLayoutName?: string | null
  onSelectedLayoutChange?: (name: string | null) => void
}

export function ControlPanel({
  state,
  aiInferenceTimeMs,
  savedLayouts = [],
  layoutName = '',
  onLayoutNameChange,
  onSaveLayout,
  onLoadLayout,
  onDeleteLayout,
  onReorderLayouts,
  selectedLayoutName = null,
  onSelectedLayoutChange,
}: ControlPanelProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
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
                Save
              </Button>
            </div>

            {/* Saved layouts list */}
            {savedLayouts.length > 0 ? (
              <div className="space-y-1">
                {savedLayouts.map((layout, index) => {
                  const isSelected = selectedLayoutName === layout.name
                  const isDragging = draggedIndex === index
                  const isDragOver = dragOverIndex === index && draggedIndex !== index
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
                        className={`flex-1 min-w-0 text-left flex items-center gap-2 text-[11px] ${
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
