import {
  createOpenRouterClient,
  extractOpenRouterCost,
  extractOpenRouterReasoningTokens,
} from '@sokoban-eval-toolkit/utils'
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
  /** Reasoning tokens (for models like o1, DeepSeek R1 that report this separately) */
  reasoningTokens: number
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

    console.log('[LLM] Request:', {
      model,
      promptLength: prompt.length,
      promptPreview: prompt.slice(0, 500) + (prompt.length > 500 ? '...' : ''),
    })

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

    const inputTokens = usage?.prompt_tokens ?? 0
    const outputTokens = usage?.completion_tokens ?? 0
    const reasoningTokens = extractOpenRouterReasoningTokens(usage)
    const cost = extractOpenRouterCost(usage)

    console.log('[LLM] Response:', {
      model,
      durationMs,
      inputTokens,
      outputTokens,
      reasoningTokens,
      cost: `$${cost.toFixed(6)}`,
      movesCount: parsed.moves.length,
      moves: parsed.moves,
      hasNativeReasoning: !!nativeReasoning,
      hasParsedReasoning: !!parsed.reasoning,
      parseError: parsed.error || null,
      rawResponse: content,
    })

    return {
      moves: parsed.moves,
      rawResponse: content,
      nativeReasoning: nativeReasoning || undefined,
      parsedReasoning: parsed.reasoning,
      inputTokens,
      outputTokens,
      reasoningTokens,
      cost,
      durationMs,
      error: parsed.error,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    console.error('[LLM] Error:', {
      model,
      durationMs,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return {
      moves: [],
      rawResponse: '',
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
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

    console.log('[LLM] Request (move-by-move):', {
      model,
      moveHistoryLength: moveHistory.length,
      promptLength: prompt.length,
    })

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
    const reasoningTokens = extractOpenRouterReasoningTokens(usage)
    const cost = extractOpenRouterCost(usage)

    console.log('[LLM] Response (move-by-move):', {
      model,
      durationMs,
      inputTokens,
      outputTokens,
      cost: `$${cost.toFixed(6)}`,
      move: parsed.moves[0] || null,
      parseError: parsed.error || null,
      rawResponse: content,
    })

    return {
      moves: parsed.moves.slice(0, 1), // Only take first move
      rawResponse: content,
      nativeReasoning: nativeReasoning || undefined,
      parsedReasoning: parsed.reasoning,
      inputTokens,
      outputTokens,
      reasoningTokens,
      cost,
      durationMs,
      error: parsed.error,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    console.error('[LLM] Error (move-by-move):', {
      model,
      durationMs,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return {
      moves: [],
      rawResponse: '',
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cost: 0,
      durationMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Create initial session metrics.
 */
export function createSessionMetrics(): SessionMetrics {
  return {
    totalCost: 0,
    totalTokens: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalReasoningTokens: 0,
    estimatedWords: 0,
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
  const newOutputTokens = metrics.totalOutputTokens + response.outputTokens
  // Estimate words from output tokens (roughly 0.75 words per token)
  const estimatedWords = Math.round(newOutputTokens * 0.75)

  return {
    totalCost: metrics.totalCost + response.cost,
    totalTokens: metrics.totalTokens + response.inputTokens + response.outputTokens,
    totalInputTokens: metrics.totalInputTokens + response.inputTokens,
    totalOutputTokens: newOutputTokens,
    totalReasoningTokens: metrics.totalReasoningTokens + response.reasoningTokens,
    estimatedWords,
    totalDurationMs: metrics.totalDurationMs + response.durationMs,
    requestCount: metrics.requestCount + 1,
  }
}
