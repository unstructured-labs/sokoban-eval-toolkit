import type { GameState, MoveDirection, SokobanLevel } from '@src/types'
import { executeMove, initializeGame, resetGame, undoMove } from '@src/utils/gameEngine'
import { useCallback, useEffect, useRef, useState } from 'react'

interface UseGameStateOptions {
  onLevelLoad?: (level: SokobanLevel) => void
}

interface UseGameStateReturn {
  gameState: GameState | null
  setGameState: React.Dispatch<React.SetStateAction<GameState | null>>
  currentLevel: SokobanLevel | null
  setCurrentLevel: React.Dispatch<React.SetStateAction<SokobanLevel | null>>
  isPlayingSolution: boolean
  handleLevelLoad: (level: SokobanLevel) => void
  handleMove: (direction: MoveDirection) => boolean
  handleAIMove: (direction: MoveDirection) => boolean
  handleUndo: () => void
  handleReset: () => void
  handleRunSolution: (moves: MoveDirection[]) => void
  stopSolution: () => void
}

export function useGameState(options: UseGameStateOptions = {}): UseGameStateReturn {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [currentLevel, setCurrentLevel] = useState<SokobanLevel | null>(null)
  const [isPlayingSolution, setIsPlayingSolution] = useState(false)

  // Refs for solution playback
  const solutionMovesRef = useRef<MoveDirection[]>([])
  const solutionIndexRef = useRef(0)
  const solutionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stop any ongoing solution playback
  const stopSolution = useCallback(() => {
    if (solutionTimeoutRef.current) {
      clearTimeout(solutionTimeoutRef.current)
      solutionTimeoutRef.current = null
    }
    setIsPlayingSolution(false)
  }, [])

  // Handle level load
  const handleLevelLoad = useCallback(
    (level: SokobanLevel) => {
      stopSolution()
      setCurrentLevel(level)
      setGameState(initializeGame(level))
      options.onLevelLoad?.(level)
    },
    [options, stopSolution],
  )

  // Handle move (returns true if valid)
  const handleMove = useCallback(
    (direction: MoveDirection): boolean => {
      if (!gameState || gameState.isWon) return false

      const newState = executeMove(gameState, direction, 'human')
      if (newState) {
        setGameState(newState)
        return true
      }
      return false
    },
    [gameState],
  )

  // Handle AI move (returns true if valid)
  const handleAIMove = useCallback(
    (direction: MoveDirection): boolean => {
      if (!gameState || gameState.isWon) return false

      const newState = executeMove(gameState, direction, 'ai')
      if (newState) {
        setGameState(newState)
        return true
      }
      return false
    },
    [gameState],
  )

  // Handle running solution - stores moves and starts playback
  const handleRunSolution = useCallback(
    (moves: MoveDirection[]) => {
      if (!gameState || moves.length === 0) return

      // Clear any existing solution playback
      stopSolution()

      // Store moves and reset index
      solutionMovesRef.current = [...moves]
      solutionIndexRef.current = 0
      setIsPlayingSolution(true)
    },
    [gameState, stopSolution],
  )

  // Effect to process solution moves one at a time
  useEffect(() => {
    if (!isPlayingSolution) return
    if (!gameState) {
      setIsPlayingSolution(false)
      return
    }

    const moves = solutionMovesRef.current
    const index = solutionIndexRef.current

    // Check if we're done
    if (index >= moves.length || gameState.isWon) {
      setIsPlayingSolution(false)
      return
    }

    const direction = moves[index]
    if (!direction) {
      setIsPlayingSolution(false)
      return
    }

    // Schedule the next move
    solutionTimeoutRef.current = setTimeout(() => {
      const newState = executeMove(gameState, direction, 'ai')
      if (newState) {
        solutionIndexRef.current = index + 1
        setGameState(newState)
      } else {
        // Move failed, stop playback
        setIsPlayingSolution(false)
      }
    }, 300)

    return () => {
      if (solutionTimeoutRef.current) {
        clearTimeout(solutionTimeoutRef.current)
        solutionTimeoutRef.current = null
      }
    }
  }, [isPlayingSolution, gameState])

  // Handle undo
  const handleUndo = useCallback(() => {
    if (!gameState) return
    setGameState(undoMove(gameState))
  }, [gameState])

  // Reset to initial state
  const handleReset = useCallback(() => {
    if (!gameState) return
    setGameState(resetGame(gameState))
  }, [gameState])

  return {
    gameState,
    setGameState,
    currentLevel,
    setCurrentLevel,
    isPlayingSolution,
    handleLevelLoad,
    handleMove,
    handleAIMove,
    handleUndo,
    handleReset,
    handleRunSolution,
    stopSolution,
  }
}
