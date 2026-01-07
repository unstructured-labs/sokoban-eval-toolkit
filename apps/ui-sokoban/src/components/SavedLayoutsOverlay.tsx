import type { SavedLayout } from '@src/utils/layoutStorage'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface SavedLayoutsOverlayProps {
  layouts: SavedLayout[]
  onLoad: (name: string) => void
  onDelete: (name: string) => void
}

export function SavedLayoutsOverlay({ layouts, onLoad, onDelete }: SavedLayoutsOverlayProps) {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (isCollapsed) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsCollapsed(true)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isCollapsed])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg"
      >
        <span>Saved Layouts ({layouts.length})</span>
        {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>

      {!isCollapsed && (
        <div className="absolute top-full left-0 mt-1 min-w-40 max-w-52 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg z-50 max-h-[420px] overflow-y-auto">
          {layouts.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground italic">
              No saved layouts yet
            </div>
          ) : (
            layouts.map((layout) => (
              <div
                key={layout.id}
                className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 group"
              >
                <button
                  type="button"
                  onClick={() => {
                    onLoad(layout.name)
                    setIsCollapsed(true)
                  }}
                  className="flex-1 text-left text-xs truncate hover:text-primary transition-colors"
                  title={`${layout.width}×${layout.height} - ${layout.difficulty} - ${layout.boxStarts.length} boxes`}
                >
                  {layout.name}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(layout.name)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-opacity"
                  title="Delete layout"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
