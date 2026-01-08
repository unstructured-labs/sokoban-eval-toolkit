import pc from 'picocolors'
import type { EvalProgress, EvalRun, SavedLayout } from './types'

/**
 * Display welcome banner.
 */
export function displayBanner(): void {
  console.log('')
  console.log(pc.cyan('╭──────────────────────────────────────────────╮'))
  console.log(
    pc.cyan('│') + pc.bold('   Sokoban Eval Toolkit - LLM Evaluation      ') + pc.cyan('│'),
  )
  console.log(pc.cyan('╰──────────────────────────────────────────────╯'))
  console.log('')
}

/**
 * Display puzzle summary.
 */
export function displayPuzzleSummary(puzzles: SavedLayout[]): void {
  console.log('')
  console.log(pc.cyan('╭─ Puzzle Summary ──────────────────────────────╮'))
  console.log(`${pc.cyan('│')} Total puzzles: ${pc.bold(puzzles.length.toString())}`)

  // Group by difficulty
  const byDifficulty: Record<string, number> = {}
  for (const puzzle of puzzles) {
    const diff = puzzle.difficulty || 'classic'
    byDifficulty[diff] = (byDifficulty[diff] || 0) + 1
  }

  if (Object.keys(byDifficulty).length > 0) {
    console.log(`${pc.cyan('│')} Difficulties:`)
    for (const [diff, count] of Object.entries(byDifficulty)) {
      console.log(`${pc.cyan('│')}   - ${diff}: ${count} puzzles`)
    }
  }

  // Grid sizes
  const sizes = new Set(puzzles.map((p) => `${p.width}x${p.height}`))
  console.log(`${pc.cyan('│')} Grid sizes: ${Array.from(sizes).join(', ')}`)

  // Total boxes
  const totalBoxes = puzzles.reduce((sum, p) => sum + p.boxStarts.length, 0)
  console.log(`${pc.cyan('│')} Total boxes: ${totalBoxes}`)

  console.log(pc.cyan('╰───────────────────────────────────────────────╯'))
  console.log('')
}

/**
 * Display puzzle list.
 */
export function displayPuzzleList(puzzles: SavedLayout[]): void {
  console.log(pc.dim('Puzzles:'))
  for (let i = 0; i < puzzles.length; i++) {
    const puzzle = puzzles[i]
    const boxCount = puzzle.boxStarts.length
    console.log(
      pc.dim(`  ${(i + 1).toString().padStart(2)}. `) +
        puzzle.name +
        pc.dim(` (${puzzle.width}x${puzzle.height}, ${boxCount} box${boxCount !== 1 ? 'es' : ''})`),
    )
  }
  console.log('')
}

/**
 * Display evaluation plan.
 */
export function displayEvalPlan(
  puzzleCount: number,
  models: string[],
  modelNames: string[],
  concurrency: number,
): void {
  console.log('')
  console.log(pc.cyan('╭─ Evaluation Plan ─────────────────────────────╮'))
  console.log(`${pc.cyan('│')} Puzzles: ${pc.bold(puzzleCount.toString())}`)
  console.log(
    `${pc.cyan('│')} Models: ${pc.bold(models.length.toString())} (${modelNames.join(', ')})`,
  )
  console.log(`${pc.cyan('│')} Concurrency: ${pc.bold(concurrency.toString())}`)
  console.log(
    `${pc.cyan('│')} Total evaluations: ${pc.bold((puzzleCount * models.length).toString())}`,
  )
  console.log(pc.cyan('╰───────────────────────────────────────────────╯'))
  console.log('')
}

/**
 * Display progress update.
 * Only shows completed results (not running status) to avoid spam with parallel execution.
 */
export function displayProgress(progress: EvalProgress): void {
  const prefix = `[${progress.currentPuzzle}/${progress.totalPuzzles}]`

  // Skip "running" status to avoid console spam with parallel execution
  if (progress.status === 'running') {
    return
  }

  if (progress.status === 'success' && progress.result) {
    const result = progress.result
    const time = formatDuration(result.inferenceTimeMs)
    const tokens = formatNumber(result.outputTokens)
    console.log(
      `${pc.dim(prefix)} ${progress.puzzleName}${pc.dim(' - ')}${progress.currentModel}${pc.dim(': ')}${pc.green('Solved')}${pc.dim(` (${result.stepsExecuted} steps, ${time}, ${tokens} tokens)`)}`,
    )
  } else if (progress.status === 'failed' && progress.result) {
    const result = progress.result
    const time = formatDuration(result.inferenceTimeMs)
    console.log(
      `${pc.dim(prefix)} ${progress.puzzleName}${pc.dim(' - ')}${progress.currentModel}${pc.dim(': ')}${pc.red('Failed')}${pc.dim(` (${result.stepsExecuted}/${result.solutionLength} steps, ${time})`)}`,
    )
  }
}

/**
 * Display results summary.
 */
export function displayResultsSummary(run: EvalRun): void {
  console.log('')
  console.log(pc.cyan('╭─ Results Summary ─────────────────────────────────────────────╮'))
  console.log(pc.cyan('│'))

  // Header
  const header = `  ${'Model'.padEnd(25)}${'Solved'.padEnd(10)}${'Avg Steps'.padEnd(12)}${'Avg Time'.padEnd(12)}Total Cost`
  console.log(pc.cyan('│') + pc.bold(header))
  console.log(`${pc.cyan('│')}  ${'─'.repeat(65)}`)

  // Each model
  for (const modelId of run.models) {
    const summary = run.summary.byModel[modelId]
    if (!summary) continue

    const solved = `${summary.puzzlesSolved}/${summary.puzzlesTotal}`
    const avgSteps = summary.avgSolveSteps !== null ? summary.avgSolveSteps.toFixed(1) : '-'
    const avgTime = formatDuration(summary.avgInferenceTimeMs)
    const cost = formatCost(summary.totalCost)

    const line = `  ${summary.modelName.slice(0, 24).padEnd(25)}${solved.padEnd(10)}${avgSteps.padEnd(12)}${avgTime.padEnd(12)}${cost}`

    console.log(pc.cyan('│') + line)
  }

  console.log(pc.cyan('│'))
  console.log(pc.cyan('╰───────────────────────────────────────────────────────────────╯'))
  console.log('')
}

/**
 * Display save confirmation.
 */
export function displaySaveConfirmation(filePaths: string[]): void {
  console.log(pc.green('Results saved to:'))
  for (const filePath of filePaths) {
    console.log(`  ${filePath}`)
  }
  console.log('')
}

/**
 * Display error message.
 */
export function displayError(message: string): void {
  console.log(`${pc.red('Error:')} ${message}`)
}

/**
 * Display info message.
 */
export function displayInfo(message: string): void {
  console.log(pc.dim(message))
}

/**
 * Format a number with commas.
 */
function formatNumber(num: number): string {
  return num.toLocaleString()
}

/**
 * Format duration in milliseconds to human readable.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  const seconds = ms / 1000
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`
  }
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format cost in dollars.
 */
function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`
  }
  return `$${cost.toFixed(2)}`
}
