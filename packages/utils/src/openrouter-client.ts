/// <reference types="bun-types" />
import OpenAI from 'openai'

export class OpenRouterConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OpenRouterConfigError'
  }
}

export function getOpenRouterApiKey(): string {
  const apiKey =
    Bun.env.OPENROUTER_API_KEY || (import.meta.env?.VITE_OPENROUTER_API_KEY as string | undefined)

  if (!apiKey) {
    throw new OpenRouterConfigError(
      'OpenRouter API key not found. Set OPENROUTER_API_KEY or VITE_OPENROUTER_API_KEY.',
    )
  }

  return apiKey
}

export function hasOpenRouterApiKey(): boolean {
  try {
    getOpenRouterApiKey()
    return true
  } catch {
    return false
  }
}

export function createOpenRouterClient(apiKey?: string): OpenAI {
  const key = apiKey ?? getOpenRouterApiKey()

  return new OpenAI({
    apiKey: key,
    baseURL: 'https://openrouter.ai/api/v1',
    dangerouslyAllowBrowser: true,
  })
}

export type OpenRouterChatParams = OpenAI.Chat.Completions.ChatCompletionCreateParams
export type OpenRouterChatResponse = OpenAI.Chat.Completions.ChatCompletion

export async function createOpenRouterChatCompletion(
  client: OpenAI,
  params: OpenRouterChatParams,
): Promise<OpenRouterChatResponse> {
  const response = await client.chat.completions.create(params)
  return response as OpenRouterChatResponse
}
