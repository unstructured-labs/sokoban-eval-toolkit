export interface OpenRouterModel {
  id: string
  name: string
  description: string
}

export const OPENROUTER_MODELS: OpenRouterModel[] = [
  /* ============================== Grok Models ============================== */
  {
    id: 'x-ai/grok-4.1-fast',
    name: 'Grok 4.1 Fast ⚡',
    description: 'Grok 4.1 Fast model',
  },

  /* ============================== Google Models ============================== */
  {
    id: 'google/gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview ⭐',
    description: "Google's flagship model",
  },
  {
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    description: "Google's fastest model",
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: "Google's model",
  },
  {
    id: 'google/gemma-3-27b-it:free',
    name: 'Gemma 3 27B IT (Free)',
    description: 'Lightweight, state-of-the-art open model (27B)',
  },
  {
    id: 'google/gemma-3-4b-it',
    name: 'Gemma 3 4B (Free)',
    description: 'Lightweight, state-of-the-art open model (4B)',
  },

  /* ============================== OpenAI Models ============================== */
  {
    id: 'openai/gpt-5.2-pro',
    name: 'GPT-5.2 Pro ⭐',
    description: 'Most capable OpenAI model (Pro)',
  },
  {
    id: 'openai/gpt-5.2',
    name: 'GPT-5.2',
    description: 'Most capable OpenAI model (Standard)',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    description: 'OpenAI GPT-4o model',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Faster, more affordable',
  },
  {
    id: 'openai/gpt-oss-20b:free',
    name: 'GPT OSS 20B (Free)',
    description: 'OpenAI open source model',
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT OSS 120B',
    description: 'OpenAI open source model',
  },

  /* ============================== Anthropic Models ============================== */
  {
    id: 'anthropic/claude-opus-4.5',
    name: 'Claude Opus 4.5 ⭐',
    description: 'Claude Opus 4.5 model',
  },
  {
    id: 'anthropic/claude-opus-4.1',
    name: 'Claude Opus 4.1',
    description: 'Claude Opus 4.1 model',
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    description: 'Claude Sonnet 4.5 model',
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    description: 'Fast and affordable',
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: "Anthropic's most capable model",
  },

  /* ============================== AllenAI Models ============================== */
  {
    id: 'allenai/olmo-3-32b-think',
    name: 'Olmo 3 32B Think',
    description: 'Olmo 3 32B Think model',
  },
  {
    id: 'allenai/olmo-3-7b-think',
    name: 'Olmo 3 7B Think',
    description: 'Olmo 3 7B Think model',
  },
  {
    id: 'allenai/olmo-3-7b-instruct',
    name: 'Olmo 3 7B Instruct',
    description: 'Olmo 3 7B Instruct model',
  },

  /* ============================== Nvidia Models ============================== */
  {
    id: 'nvidia/nemotron-nano-12b-v2-vl:free',
    name: 'Nemotron Nano 12B (Free)',
    description: 'Nvidia Nemotron Nano',
  },

  /* ============================== Meta Models ============================== */
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B (Free)',
    description: 'Meta Llama 3.3 70B Instruct',
  },
  {
    id: 'meta-llama/llama-3.2-3b-instruct:free',
    name: 'Llama 3.2 3B Instruct (Free)',
    description: '3B multilingual model optimized for dialogue, reasoning, and summarization',
  },

  /* ============================== Chinese Models ============================== */
  {
    id: 'moonshotai/kimi-k2-thinking',
    name: 'Kimi K2 Thinking',
    description: 'Kimi K2 Thinking model',
  },
  {
    id: 'qwen/qwen3-32b',
    name: 'Qwen3 32B',
    description: 'Qwen3 32B model',
  },
  {
    id: 'qwen/qwen3-14b',
    name: 'Qwen3 14B',
    description: 'Qwen3 14B model',
  },
  {
    id: 'qwen/qwen3-8b',
    name: 'Qwen3 8B',
    description: 'Qwen3 8B model',
  },
  {
    id: 'z-ai/glm-4.7',
    name: 'GLM 4.7',
    description: 'Z-AI GLM 4.7 model',
  },
  {
    id: 'deepseek/deepseek-v3.2',
    name: 'DeepSeek V3.2',
    description: 'DeepSeek V3.2 model',
  },
  {
    id: 'deepseek/deepseek-v3.2-speciale',
    name: 'DeepSeek V3.2 Speciale',
    description: 'DeepSeek V3.2 Speciale model',
  },
]
