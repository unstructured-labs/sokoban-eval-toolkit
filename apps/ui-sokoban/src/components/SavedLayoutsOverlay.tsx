import type { SavedLayout } from '@src/utils/layoutStorage'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { useState } from 'react'

interface SavedLayoutsOverlayProps {
  layouts: SavedLayout[]
  onLoad: (name: string) => void
  onDelete: (name: string) => void
}

export function SavedLayoutsOverlay({ layouts, onLoad, onDelete }: SavedLayoutsOverlayProps) {
  const [isCollapsed, setIsCollapsed] = useState(true)

  return (
    <div className="self-start bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg min-w-40 max-w-52">
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Saved Layouts ({layouts.length})</span>
        {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>

      {!isCollapsed && (
        <div className="max-h-48 overflow-y-auto border-t">
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
                  onClick={() => onLoad(layout.name)}
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
