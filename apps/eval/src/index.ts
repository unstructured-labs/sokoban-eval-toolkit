import { hasOpenRouterApiKey } from '@sokoban-eval-toolkit/utils'
import { OPENROUTER_MODELS } from '@sokoban-eval-toolkit/utils'
import { getDatasetInfo, loadDataset } from './datasets'
import {
  displayBanner,
  displayError,
  displayEvalPlan,
  displayInfo,
  displayProgress,
  displayPuzzleList,
  displayPuzzleSummary,
  displayResultsSummary,
  displaySaveConfirmation,
} from './display'
import { runEvaluation } from './eval-runner'
import {
  confirmStart,
  promptEvalOptions,
  promptModelSelection,
  promptPuzzleLimit,
  promptPuzzleSource,
} from './prompts'
import { loadPuzzles } from './puzzle-loader'
import { saveEvalRun } from './results-storage'
import type { SavedLayout } from './types'

async function main(): Promise<void> {
  // Display welcome banner
  displayBanner()

  // Check for API key
  if (!hasOpenRouterApiKey()) {
    displayError(
      'OpenRouter API key not found. Set OPENROUTER_API_KEY or VITE_OPENROUTER_API_KEY environment variable.',
    )
    process.exit(1)
  }

  try {
    // Prompt for puzzle source
    const puzzleSource = await promptPuzzleSource()

    // Load puzzles based on source
    let puzzles: SavedLayout[]
    let puzzleSourceName: string

    if (puzzleSource.type === 'dataset') {
      const datasetInfo = getDatasetInfo(puzzleSource.datasetId)
      puzzleSourceName = datasetInfo?.name ?? puzzleSource.datasetId
      displayInfo(`Loading ${puzzleSourceName} dataset...`)
      puzzles = await loadDataset(puzzleSource.datasetId)
      displayInfo(`Loaded ${puzzles.length} puzzles`)
    } else {
      puzzleSourceName = puzzleSource.path
      displayInfo(`Loading puzzles from ${puzzleSource.path}...`)
      puzzles = await loadPuzzles(puzzleSource.path)
      displayInfo(`Loaded ${puzzles.length} puzzles`)
    }

    // Prompt for puzzle limit if dataset is large
    const puzzleLimit = await promptPuzzleLimit(puzzles.length)
    if (puzzleLimit < puzzles.length) {
      puzzles = puzzles.slice(0, puzzleLimit)
      displayInfo(`Using first ${puzzleLimit} puzzles`)
    }

    // Display puzzle summary
    displayPuzzleSummary(puzzles)
    displayPuzzleList(puzzles)

    // Prompt for model selection
    const selectedModels = await promptModelSelection()
    if (selectedModels.length === 0) {
      displayError('No models selected')
      process.exit(1)
    }

    // Get model names for display
    const modelNames = selectedModels.map((id) => {
      const model = OPENROUTER_MODELS.find((m) => m.id === id)
      return model?.name ?? id
    })

    // Prompt for eval options
    const options = await promptEvalOptions()

    // Display eval plan
    displayEvalPlan(puzzles.length, selectedModels, modelNames, options.concurrency)

    // Confirm start
    const shouldStart = await confirmStart(puzzles.length, selectedModels.length)
    if (!shouldStart) {
      displayInfo('Evaluation cancelled')
      process.exit(0)
    }

    // Run evaluation
    console.log('')
    displayInfo('Starting evaluation...')
    console.log('')

    const run = await runEvaluation(
      puzzles,
      selectedModels,
      options,
      puzzleSourceName,
      (progress) => {
        displayProgress(progress)
      },
    )

    // Display results summary
    displayResultsSummary(run)

    // Save results (one file per model)
    const savedPaths = await saveEvalRun(run)
    displaySaveConfirmation(savedPaths)
  } catch (error) {
    if (error instanceof Error) {
      // Handle user cancellation gracefully
      if (error.message.includes('User force closed')) {
        console.log('')
        displayInfo('Evaluation cancelled')
        process.exit(0)
      }
      displayError(error.message)
    } else {
      displayError('An unknown error occurred')
    }
    process.exit(1)
  }
}

// Run main
main()
