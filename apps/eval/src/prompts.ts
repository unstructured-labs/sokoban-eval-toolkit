import { confirm, input, number as inputNumber, select } from '@inquirer/prompts'
import { OPENROUTER_MODELS } from '@sokoban-eval-toolkit/utils'
import { DATASETS, type DatasetId } from './datasets'
import type { EvalOptions } from './types'

export type PuzzleSource =
  | { type: 'dataset'; datasetId: DatasetId }
  | { type: 'custom'; path: string }

/**
 * Prompt for puzzle source selection.
 */
export async function promptPuzzleSource(): Promise<PuzzleSource> {
  const choices = [
    ...DATASETS.map((d) => ({
      name: `${d.name} - ${d.description}`,
      value: d.id as string,
    })),
    {
      name: 'Custom JSON file',
      value: 'custom',
    },
  ]

  const selected = await select({
    message: 'Select puzzle source:',
    choices,
    pageSize: 10,
  })

  if (selected === 'custom') {
    const path = await input({
      message: 'Enter path to puzzle export file:',
      default: './data/puzzles.json',
      validate: (value) => {
        if (!value.trim()) {
          return 'Please enter a file path'
        }
        return true
      },
    })
    return { type: 'custom', path }
  }

  return { type: 'dataset', datasetId: selected as DatasetId }
}

/**
 * Prompt for model selection (single model).
 */
export async function promptModelSelection(): Promise<string[]> {
  const choices = OPENROUTER_MODELS.map((model) => ({
    name: model.name,
    value: model.id,
  }))

  const selected = await select({
    message: 'Select model to evaluate:',
    choices,
    pageSize: 15,
  })

  return [selected]
}

/**
 * Prompt for puzzle limit (for large datasets).
 */
export async function promptPuzzleLimit(totalPuzzles: number): Promise<number> {
  if (totalPuzzles <= 10) {
    return totalPuzzles // No need to limit small datasets
  }

  const limit = await inputNumber({
    message: `How many puzzles to evaluate? (dataset has ${totalPuzzles}):`,
    default: Math.min(10, totalPuzzles),
    min: 1,
    max: totalPuzzles,
  })

  return limit ?? Math.min(10, totalPuzzles)
}

/**
 * Prompt for eval options.
 */
export async function promptEvalOptions(): Promise<EvalOptions> {
  const concurrency = await inputNumber({
    message: 'Concurrency (parallel evaluations):',
    default: 10,
    min: 1,
    max: 50,
  })

  return {
    concurrency: concurrency ?? 10,
  }
}

/**
 * Confirm before starting evaluation.
 */
export async function confirmStart(puzzleCount: number, modelCount: number): Promise<boolean> {
  const totalEvals = puzzleCount * modelCount

  return confirm({
    message: `Start evaluation? (${puzzleCount} puzzles × ${modelCount} models = ${totalEvals} evaluations)`,
    default: true,
  })
}
