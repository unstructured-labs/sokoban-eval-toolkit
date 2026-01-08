import pLimit from 'p-limit'
import { v4 as uuidv4 } from 'uuid'
import { evaluatePuzzle, getModelName } from './model-runner'
import type {
  EvalOptions,
  EvalProgress,
  EvalResult,
  EvalRun,
  ModelSummary,
  SavedLayout,
} from './types'

/**
 * Calculate summary statistics for a model.
 */
function calculateModelSummary(modelId: string, results: EvalResult[]): ModelSummary {
  const modelResults = results.filter((r) => r.modelId === modelId)
  const solvedResults = modelResults.filter((r) => r.solved)

  const avgSolveSteps =
    solvedResults.length > 0
      ? solvedResults.reduce((sum, r) => sum + r.stepsExecuted, 0) / solvedResults.length
      : null

  const avgInferenceTimeMs =
    modelResults.length > 0
      ? modelResults.reduce((sum, r) => sum + r.inferenceTimeMs, 0) / modelResults.length
      : 0

  const totalOutputTokens = modelResults.reduce((sum, r) => sum + r.outputTokens, 0)
  const totalCost = modelResults.reduce((sum, r) => sum + r.cost, 0)

  return {
    modelId,
    modelName: getModelName(modelId),
    puzzlesSolved: solvedResults.length,
    puzzlesTotal: modelResults.length,
    avgSolveSteps,
    avgInferenceTimeMs,
    totalOutputTokens,
    totalCost,
  }
}

interface EvalTask {
  puzzleIndex: number
  puzzle: SavedLayout
  modelId: string
}

/**
 * Run evaluation for all puzzles and models with parallel execution.
 */
export async function runEvaluation(
  puzzles: SavedLayout[],
  models: string[],
  options: EvalOptions,
  puzzleFile: string,
  onProgress?: (progress: EvalProgress) => void,
): Promise<EvalRun> {
  const runId = uuidv4()
  const startedAt = Date.now()

  // Create all evaluation tasks
  const tasks: EvalTask[] = []
  for (let puzzleIndex = 0; puzzleIndex < puzzles.length; puzzleIndex++) {
    const puzzle = puzzles[puzzleIndex]
    for (const modelId of models) {
      tasks.push({ puzzleIndex, puzzle, modelId })
    }
  }

  const totalTasks = tasks.length
  let completedTasks = 0

  // Create concurrency limiter
  const limit = pLimit(options.concurrency)

  // Run all tasks in parallel with concurrency limit
  const results = await Promise.all(
    tasks.map((task) =>
      limit(async (): Promise<EvalResult> => {
        // Report starting
        onProgress?.({
          currentPuzzle: completedTasks + 1,
          totalPuzzles: totalTasks,
          currentModel: getModelName(task.modelId),
          puzzleName: task.puzzle.name,
          status: 'running',
        })

        // Evaluate this puzzle with this model
        const result = await evaluatePuzzle(task.puzzle, task.modelId)
        completedTasks++

        // Report result
        onProgress?.({
          currentPuzzle: completedTasks,
          totalPuzzles: totalTasks,
          currentModel: getModelName(task.modelId),
          puzzleName: task.puzzle.name,
          status: result.solved ? 'success' : 'failed',
          result,
        })

        return result
      }),
    ),
  )

  // Calculate summaries
  const byModel: Record<string, ModelSummary> = {}
  for (const modelId of models) {
    byModel[modelId] = calculateModelSummary(modelId, results)
  }

  return {
    id: runId,
    startedAt,
    completedAt: Date.now(),
    puzzleFile,
    puzzleCount: puzzles.length,
    models,
    options,
    results,
    summary: { byModel },
    status: 'completed',
  }
}
