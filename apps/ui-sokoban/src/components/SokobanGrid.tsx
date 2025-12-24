import { CELL_SIZE } from '@src/constants'
import type { GameState, Position } from '@src/types'

interface SelectedEntity {
  type: 'player' | 'box' | 'goal'
  index?: number
  x: number
  y: number
}

interface SokobanGridProps {
  state: GameState | null
  highlightedCells?: Position[]
  className?: string
  isEditing?: boolean
  onCellClick?: (x: number, y: number) => void
  selectedEntity?: SelectedEntity | null
  onCellDragStart?: (x: number, y: number) => void
  onCellDragEnter?: (x: number, y: number) => void
  onDragEnd?: () => void
  isDragging?: boolean
}

export function SokobanGrid({
  state,
  highlightedCells = [],
  className = '',
  isEditing = false,
  onCellClick,
  selectedEntity = null,
  onCellDragStart,
  onCellDragEnter,
  onDragEnd,
  isDragging = false,
}: SokobanGridProps) {
  if (!state) {
    return (
      <div
        className={`flex items-center justify-center bg-muted/20 rounded-lg p-8 ${className}`}
        style={{ width: CELL_SIZE * 10, height: CELL_SIZE * 10 }}
      >
        <p className="text-muted-foreground text-sm">No puzzle loaded</p>
      </div>
    )
  }

  const { level, playerPos, boxes } = state

  const isHighlighted = (x: number, y: number) =>
    highlightedCells.some((c) => c.x === x && c.y === y)

  const isBox = (x: number, y: number) => boxes.some((b) => b.x === x && b.y === y)

  const isBoxOnGoal = (x: number, y: number) => isBox(x, y) && level.terrain[y]?.[x] === 'goal'

  const isGoal = (x: number, y: number) => level.terrain[y]?.[x] === 'goal'

  const isPlayer = (x: number, y: number) => playerPos.x === x && playerPos.y === y

  const gridWidth = level.width * CELL_SIZE
  const gridHeight = level.height * CELL_SIZE

  return (
    <div className={`inline-block rounded overflow-hidden animate-fade-in ${className}`}>
      <div
        className="relative bg-[hsl(var(--sokoban-floor))]"
        style={{
          width: gridWidth,
          height: gridHeight,
          display: 'grid',
          gridTemplateColumns: `repeat(${level.width}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${level.height}, ${CELL_SIZE}px)`,
        }}
      >
        {/* Render cells - grid positions are stable, so index-based keys are safe */}
        {level.terrain.map((row, y) =>
          row.map((terrain, x) => {
            const isWall = terrain === 'wall'
            const cellIsGoal = isGoal(x, y)
            const cellHasBox = isBox(x, y)
            const cellBoxOnGoal = isBoxOnGoal(x, y)
            const cellIsPlayer = isPlayer(x, y)
            const cellIsHighlighted = isHighlighted(x, y)
            const cellKey = `cell-${x}-${y}`

            // Check if this cell's entity is selected
            const isSelectedPlayer = selectedEntity?.type === 'player' && cellIsPlayer
            const isSelectedBox =
              selectedEntity?.type === 'box' &&
              cellHasBox &&
              selectedEntity.x === x &&
              selectedEntity.y === y
            const isSelectedGoal =
              selectedEntity?.type === 'goal' &&
              cellIsGoal &&
              !cellHasBox &&
              !cellIsPlayer &&
              selectedEntity.x === x &&
              selectedEntity.y === y

            // Can click if: editing mode on
            const canClick = isEditing

            // Check if this is a plain floor/wall cell (no entities)
            const isPlainCell = !cellIsPlayer && !cellHasBox && !cellIsGoal

            return (
              <div
                key={cellKey}
                className={`relative transition-all duration-150 ${canClick ? 'cursor-pointer hover:brightness-150' : ''} select-none outline-none`}
                style={{
                  backgroundColor: isWall
                    ? 'hsl(var(--sokoban-wall))'
                    : cellIsHighlighted
                      ? 'hsl(var(--primary) / 0.2)'
                      : 'hsl(var(--sokoban-floor))',
                }}
                onClick={canClick ? () => onCellClick?.(x, y) : undefined}
                onMouseDown={
                  canClick && isPlainCell
                    ? (e) => {
                        e.preventDefault()
                        onCellDragStart?.(x, y)
                      }
                    : undefined
                }
                onMouseEnter={
                  canClick && isDragging && isPlainCell ? () => onCellDragEnter?.(x, y) : undefined
                }
                onMouseUp={canClick ? () => onDragEnd?.() : undefined}
                onKeyDown={
                  canClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onCellClick?.(x, y)
                        }
                      }
                    : undefined
                }
                role={canClick ? 'button' : undefined}
                tabIndex={canClick ? 0 : undefined}
              >
                {/* Goal marker (underneath box/player) */}
                {cellIsGoal && !cellHasBox && !cellIsPlayer && (
                  <div
                    className="absolute rounded-full opacity-60"
                    style={{
                      inset: 8,
                      backgroundColor: 'hsl(var(--sokoban-goal))',
                      boxShadow: isSelectedGoal ? '0 0 0 3px #facc15' : undefined,
                    }}
                  />
                )}

                {/* Goal hint when covered by player */}
                {cellIsGoal && cellIsPlayer && (
                  <div
                    className="absolute rounded-full border-2 border-dashed"
                    style={{
                      inset: 4,
                      borderColor: 'hsl(var(--sokoban-goal))',
                    }}
                  />
                )}

                {/* Box */}
                {cellHasBox && (
                  <div
                    className="absolute rounded-sm flex items-center justify-center font-bold text-white shadow-md transition-all duration-150"
                    style={{
                      inset: 4,
                      backgroundColor: cellBoxOnGoal
                        ? 'hsl(var(--sokoban-box-done))'
                        : 'hsl(var(--sokoban-box))',
                      border: isSelectedBox
                        ? '3px solid #facc15'
                        : cellBoxOnGoal
                          ? 'none'
                          : '2px solid hsl(var(--sokoban-box) / 0.7)',
                      boxShadow: isSelectedBox ? '0 0 8px #facc15' : undefined,
                    }}
                  >
                    {cellBoxOnGoal && <span className="text-xs">✓</span>}
                  </div>
                )}

                {/* Player */}
                {cellIsPlayer && (
                  <div
                    className="absolute rounded-full flex items-center justify-center shadow-lg"
                    style={{
                      inset: 4,
                      backgroundColor: 'hsl(var(--sokoban-player))',
                      border: isSelectedPlayer
                        ? '3px solid #facc15'
                        : '3px solid hsl(var(--sokoban-player) / 0.5)',
                      boxShadow: isSelectedPlayer ? '0 0 8px #facc15' : undefined,
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: 'hsl(var(--sokoban-player) / 0.3)' }}
                    />
                  </div>
                )}
              </div>
            )
          }),
        )}
      </div>
    </div>
  )
}
