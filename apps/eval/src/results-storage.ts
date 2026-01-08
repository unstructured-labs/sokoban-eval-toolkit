import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { EvalRun } from './types'

// Results directory relative to monorepo root
const RESULTS_DIR = join(import.meta.dir, '../../../data/eval-results')

/**
 * Ensure the results directory exists.
 */
async function ensureResultsDir(): Promise<void> {
  await mkdir(RESULTS_DIR, { recursive: true })
}

/**
 * Generate a short filename-safe model identifier.
 */
function getModelShortName(modelId: string): string {
  const parts = modelId.split('/')
  const name = parts[parts.length - 1]
  return name
    .replace('claude-', 'c')
    .replace('gpt-', 'gpt')
    .replace('gemini-', 'gem')
    .replace('-preview', '')
    .replace('-instruct', '')
    .slice(0, 20)
}

/**
 * Generate a filename-safe puzzle source identifier.
 */
function getPuzzleSourceShortName(puzzleFile: string): string {
  // Handle dataset names
  const lower = puzzleFile.toLowerCase()
  if (lower.includes('microban')) return 'microban'
  if (lower.includes('boxoban') && lower.includes('medium')) return 'boxoban-med'
  if (lower.includes('boxoban') && lower.includes('hard')) return 'boxoban-hard'

  // Handle file paths - extract filename without extension
  const basename = puzzleFile.split('/').pop() || puzzleFile
  return basename
    .replace(/\.json$/, '')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .slice(0, 15)
}

/**
 * Save an eval run to disk, creating separate files per model.
 * Returns array of saved file paths.
 */
export async function saveEvalRun(run: EvalRun): Promise<string[]> {
  await ensureResultsDir()

  const date = new Date(run.startedAt).toISOString().split('T')[0]
  const puzzleSource = getPuzzleSourceShortName(run.puzzleFile)
  const savedPaths: string[] = []

  for (const modelId of run.models) {
    // Filter results for this model
    const modelResults = run.results.filter((r) => r.modelId === modelId)
    const modelSummary = run.summary.byModel[modelId]

    // Create per-model run object
    const modelRun: EvalRun = {
      ...run,
      models: [modelId],
      results: modelResults,
      summary: {
        byModel: modelSummary ? { [modelId]: modelSummary } : {},
      },
    }

    const shortName = getModelShortName(modelId)
    const filename = `${date}-${puzzleSource}-${shortName}.json`
    const filePath = join(RESULTS_DIR, filename)

    await Bun.write(filePath, JSON.stringify(modelRun, null, 2))
    savedPaths.push(filePath)
  }

  return savedPaths
}

/**
 * Load all previous eval runs.
 */
export async function loadEvalRuns(): Promise<EvalRun[]> {
  await ensureResultsDir()

  const glob = new Bun.Glob('*.json')
  const runs: EvalRun[] = []

  for await (const filename of glob.scan(RESULTS_DIR)) {
    try {
      const filePath = join(RESULTS_DIR, filename)
      const content = await Bun.file(filePath).text()
      const run = JSON.parse(content) as EvalRun
      runs.push(run)
    } catch {
      // Skip invalid files
    }
  }

  // Sort by start time, newest first
  runs.sort((a, b) => b.startedAt - a.startedAt)

  return runs
}

/**
 * Get the results directory path.
 */
export function getResultsDir(): string {
  return RESULTS_DIR
}
