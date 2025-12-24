import type React from 'react'
import { useEffect, useRef, useState } from 'react'

interface SquareLoaderProps {
  size?: number
  gap?: number
  color?: string
  uniformColor?: boolean
}

interface Position {
  x: number
  y: number
}

type CornerIndex = 0 | 1 | 2 | 3

export const SquareLoader: React.FC<SquareLoaderProps> = ({
  size = 24,
  gap = 8,
  color = '#3b82f6',
  uniformColor = false,
}) => {
  const [positions, setPositions] = useState<number[]>([0, 1, 2])
  const positionsRef = useRef<number[]>(positions)

  const shades: string[] = uniformColor
    ? [color, color, color]
    : [color, adjustBrightness(color, -15), adjustBrightness(color, -30)]

  useEffect(() => {
    positionsRef.current = positions
  }, [positions])

  useEffect(() => {
    let timeout1: ReturnType<typeof setTimeout>
    let timeout2: ReturnType<typeof setTimeout>
    let timeout3: ReturnType<typeof setTimeout>

    const delayOne = 400
    const delayTwo = 200
    const delayThree = 600

    const animate = (): void => {
      const currentPositions = positionsRef.current

      const emptyCorner = ([0, 1, 2, 3] as CornerIndex[]).find(
        (c) => !currentPositions.includes(c),
      ) as CornerIndex

      const leaderCorner = ((emptyCorner + 3) % 4) as CornerIndex
      const secondCorner = ((emptyCorner + 2) % 4) as CornerIndex
      const thirdCorner = ((emptyCorner + 1) % 4) as CornerIndex

      const leaderIndex = currentPositions.findIndex((p) => p === leaderCorner)
      const secondIndex = currentPositions.findIndex((p) => p === secondCorner)
      const thirdIndex = currentPositions.findIndex((p) => p === thirdCorner)

      setPositions((prev) => {
        const newPositions = [...prev]
        newPositions[leaderIndex] = (newPositions[leaderIndex] + 1) % 4
        return newPositions
      })

      timeout1 = setTimeout(() => {
        setPositions((prev) => {
          const newPositions = [...prev]
          newPositions[secondIndex] = (newPositions[secondIndex] + 1) % 4
          return newPositions
        })

        timeout2 = setTimeout(() => {
          setPositions((prev) => {
            const newPositions = [...prev]
            newPositions[thirdIndex] = (newPositions[thirdIndex] + 1) % 4
            return newPositions
          })

          timeout3 = setTimeout(animate, delayThree)
        }, delayTwo)
      }, delayOne)
    }

    animate()

    return () => {
      clearTimeout(timeout1)
      clearTimeout(timeout2)
      clearTimeout(timeout3)
    }
  }, [])

  const corners: Record<CornerIndex, Position> = {
    0: { x: 0, y: 0 },
    1: { x: size + gap, y: 0 },
    2: { x: size + gap, y: size + gap },
    3: { x: 0, y: size + gap },
  }

  const containerSize = size * 2 + gap
  const transitionDuration = 350

  return (
    <div
      style={{
        position: 'relative',
        width: containerSize,
        height: containerSize,
      }}
    >
      {([0, 1, 2] as const).map((squareIndex) => {
        const cornerIndex = positions[squareIndex] as CornerIndex
        const pos = corners[cornerIndex]

        return (
          <div
            key={squareIndex}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              backgroundColor: shades[squareIndex],
              borderRadius: size * 0.15,
              transform: `translate(${pos.x}px, ${pos.y}px)`,
              transition: `transform ${transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            }}
          />
        )
      })}
    </div>
  )
}

function adjustBrightness(hex: string, percent: number): string {
  const num = Number.parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + percent))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent))
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent))
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}
