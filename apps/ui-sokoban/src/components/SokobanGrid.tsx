import { BOX_COLORS, CELL_SIZE } from '@src/constants'
import type { Box, BoxColor, GameState, Position } from '@src/types'

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
  addMode?: 'goal' | 'box' | BoxColor | 'wall' | 'remove' | null
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
  addMode = null,
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

  const getBoxAt = (x: number, y: number): Box | undefined =>
    boxes.find((b) => b.x === x && b.y === y)

  const isBox = (x: number, y: number) => boxes.some((b) => b.x === x && b.y === y)

  const isGoal = (x: number, y: number) => level.terrain[y]?.[x] === 'goal'

  const isBoxOnGoal = (x: number, y: number) => isBox(x, y) && isGoal(x, y)

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

            // Check if this cell is a valid target for add mode
            const isBorderCell =
              x === 0 || x === level.width - 1 || y === 0 || y === level.height - 1
            const canAddGoal = addMode === 'goal' && !isWall && !cellIsGoal && !isBorderCell
            const isBoxAddMode =
              addMode === 'box' ||
              addMode === 'orange' ||
              addMode === 'purple' ||
              addMode === 'emerald' ||
              addMode === 'sky'
            const canAddBox =
              isBoxAddMode && !isWall && !cellIsPlayer && !cellHasBox && !isBorderCell
            const canToggleWall =
              addMode === 'wall' && !isBorderCell && !cellIsPlayer && !cellHasBox && !cellIsGoal
            const canRemove = addMode === 'remove' && (cellIsGoal || cellHasBox)

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
                  cursor:
                    canAddGoal || canAddBox
                      ? 'crosshair'
                      : canToggleWall
                        ? 'cell'
                        : canRemove
                          ? 'pointer'
                          : undefined,
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
                {cellHasBox &&
                  (() => {
                    const box = getBoxAt(x, y)
                    const boxColors = box ? BOX_COLORS[box.color] : BOX_COLORS.orange
                    return (
                      <div
                        className="absolute rounded-sm flex items-center justify-center font-bold text-white shadow-md transition-all duration-150"
                        style={{
                          inset: 4,
                          backgroundColor: boxColors.bg,
                          border: isSelectedBox
                            ? '3px solid #facc15'
                            : cellBoxOnGoal
                              ? '2px solid #22c55e'
                              : `2px solid ${boxColors.border}`,
                          boxShadow: isSelectedBox
                            ? '0 0 8px #facc15'
                            : cellBoxOnGoal
                              ? '0 0 6px #22c55e'
                              : undefined,
                        }}
                      >
                        {cellBoxOnGoal && <span className="text-xs">✓</span>}
                      </div>
                    )
                  })()}

                {/* Player */}
                {cellIsPlayer && (
                  <div
                    className="absolute flex items-center justify-center text-2xl select-none"
                    style={{
                      inset: 2,
                      filter: isSelectedPlayer ? 'drop-shadow(0 0 6px #facc15)' : undefined,
                    }}
                  >
                    👷
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
