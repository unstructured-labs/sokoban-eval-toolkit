import { createOpenRouterClient } from '@sokoban-eval-toolkit/utils'
import type { GameState, MoveDirection, PromptOptions, SessionMetrics } from '@src/types'
import { generateMoveByMovePrompt, generateSokobanPrompt } from '@src/utils/promptGeneration'
import { parseAIResponse } from '@src/utils/solutionValidator'

function getApiKey(): string | undefined {
  return import.meta.env.VITE_OPENROUTER_API_KEY
}

export function hasOpenRouterApiKey(): boolean {
  const key = getApiKey()
  return !!key && key.length > 0
}

export interface LLMResponse {
  moves: MoveDirection[]
  rawResponse: string
  /** Native reasoning from the model (e.g., DeepSeek R1 thinking output) */
  nativeReasoning?: string
  /** Reasoning parsed from the response content (e.g., from JSON "reasoning" field) */
  parsedReasoning?: string
  inputTokens: number
  outputTokens: number
  cost: number
  durationMs: number
  error?: string
}

/**
 * Get a solution from the LLM for a Sokoban puzzle.
 */
export async function getSokobanSolution(
  state: GameState,
  model: string,
  options: PromptOptions,
): Promise<LLMResponse> {
  const startTime = Date.now()

  try {
    const apiKey = getApiKey()
    if (!apiKey) {
      throw new Error('API key not configured')
    }
    const client = createOpenRouterClient(apiKey)

    const prompt = generateSokobanPrompt(state, options)

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user' as const, content: prompt }],
      temperature: 0.3,
    })

    const durationMs = Date.now() - startTime
    const message = response.choices[0]?.message
    const content = message?.content ?? ''
    const usage = response.usage

    // Extract native reasoning from OpenRouter response (some models like DeepSeek provide this)
    // biome-ignore lint/suspicious/noExplicitAny: OpenRouter-specific field not in OpenAI types
    const nativeReasoning = (message as any)?.reasoning as string | undefined

    const parsed = parseAIResponse(content)

    // Estimate cost (rough approximation - OpenRouter provides actual cost in headers)
    const inputTokens = usage?.prompt_tokens ?? 0
    const outputTokens = usage?.completion_tokens ?? 0
    const cost = estimateCost(model, inputTokens, outputTokens)

    return {
      moves: parsed.moves,
      rawResponse: content,
      nativeReasoning: nativeReasoning || undefined,
      parsedReasoning: parsed.reasoning,
      inputTokens,
      outputTokens,
      cost,
      durationMs,
      error: parsed.error,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    return {
      moves: [],
      rawResponse: '',
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      durationMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get the next move from the LLM (move-by-move mode).
 */
export async function getNextMove(
  state: GameState,
  model: string,
  moveHistory: string[],
): Promise<LLMResponse> {
  const startTime = Date.now()

  try {
    const apiKey = getApiKey()
    if (!apiKey) {
      throw new Error('API key not configured')
    }
    const client = createOpenRouterClient(apiKey)

    const prompt = generateMoveByMovePrompt(state, moveHistory)

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 50, // We only need one move
    })

    const durationMs = Date.now() - startTime
    const message = response.choices[0]?.message
    const content = message?.content ?? ''
    const usage = response.usage

    // Extract native reasoning from OpenRouter response (some models like DeepSeek provide this)
    // @ts-expect-error - OpenRouter-specific field not in OpenAI types
    const nativeReasoning = message?.reasoning as string | undefined

    const parsed = parseAIResponse(content)

    const inputTokens = usage?.prompt_tokens ?? 0
    const outputTokens = usage?.completion_tokens ?? 0
    const cost = estimateCost(model, inputTokens, outputTokens)

    return {
      moves: parsed.moves.slice(0, 1), // Only take first move
      rawResponse: content,
      nativeReasoning: nativeReasoning || undefined,
      parsedReasoning: parsed.reasoning,
      inputTokens,
      outputTokens,
      cost,
      durationMs,
      error: parsed.error,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    return {
      moves: [],
      rawResponse: '',
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      durationMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Rough cost estimation based on model.
 * Actual costs may vary - this is for display purposes.
 */
function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Very rough estimates per 1K tokens
  const rates: Record<string, { input: number; output: number }> = {
    'openai/gpt-4o': { input: 0.005, output: 0.015 },
    'openai/gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'anthropic/claude-3.5-sonnet': { input: 0.003, output: 0.015 },
    'anthropic/claude-haiku-4.5': { input: 0.0008, output: 0.004 },
    'google/gemini-2.5-pro': { input: 0.00125, output: 0.005 },
  }

  const rate = rates[model] ?? { input: 0.001, output: 0.003 }
  return (inputTokens * rate.input + outputTokens * rate.output) / 1000
}

/**
 * Create initial session metrics.
 */
export function createSessionMetrics(): SessionMetrics {
  return {
    totalCost: 0,
    totalTokens: 0,
    totalDurationMs: 0,
    requestCount: 0,
  }
}

/**
 * Update session metrics with a new response.
 */
export function updateSessionMetrics(
  metrics: SessionMetrics,
  response: LLMResponse,
): SessionMetrics {
  return {
    totalCost: metrics.totalCost + response.cost,
    totalTokens: metrics.totalTokens + response.inputTokens + response.outputTokens,
    totalDurationMs: metrics.totalDurationMs + response.durationMs,
    requestCount: metrics.requestCount + 1,
  }
}
