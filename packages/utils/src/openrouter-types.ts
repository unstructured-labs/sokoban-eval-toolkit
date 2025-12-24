/**
 * OpenRouter-specific types that extend the OpenAI SDK types
 */

/** OpenRouter cost breakdown details */
export interface OpenRouterCostDetails {
  upstream_inference_cost: number | null
  upstream_inference_prompt_cost: number
  upstream_inference_completions_cost: number
}

/** OpenRouter token details for prompts */
export interface OpenRouterPromptTokensDetails {
  cached_tokens: number
  audio_tokens: number
  video_tokens: number
}

/** OpenRouter token details for completions */
export interface OpenRouterCompletionTokensDetails {
  reasoning_tokens: number
  image_tokens: number
}

/**
 * Extended usage object returned by OpenRouter when `usage: { include: true }` is set.
 * Extends the standard OpenAI usage with cost and detailed breakdowns.
 */
export interface OpenRouterUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost: number
  is_byok: boolean
  prompt_tokens_details: OpenRouterPromptTokensDetails
  cost_details: OpenRouterCostDetails
  completion_tokens_details: OpenRouterCompletionTokensDetails
}

function coerceNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * Helper to extract cost from OpenRouter usage object.
 * Returns 0 if cost is not available.
 */
export function extractOpenRouterCost(usage: unknown): number {
  if (usage && typeof usage === 'object' && 'cost' in usage && usage.cost !== undefined) {
    return coerceNumber(usage.cost)
  }
  return 0
}

/**
 * Helper to extract reasoning tokens from OpenRouter usage object.
 */
export function extractOpenRouterReasoningTokens(usage: unknown): number {
  if (
    usage &&
    typeof usage === 'object' &&
    'completion_tokens_details' in usage &&
    usage.completion_tokens_details
  ) {
    const details = usage.completion_tokens_details as OpenRouterCompletionTokensDetails
    return coerceNumber(details.reasoning_tokens)
  }
  return 0
}

/**
 * Helper to extract cached prompt tokens from OpenRouter usage object.
 */
export function extractOpenRouterCachedPromptTokens(usage: unknown): number {
  if (
    usage &&
    typeof usage === 'object' &&
    'prompt_tokens_details' in usage &&
    usage.prompt_tokens_details
  ) {
    const details = usage.prompt_tokens_details as OpenRouterPromptTokensDetails
    return coerceNumber(details.cached_tokens)
  }
  return 0
}
