export interface OpenRouterModelPricing {
  /** Price per million tokens for input/prompt */
  prompt: number
  /** Price per million tokens for output/completion */
  completion: number
  /** Price per image (if applicable) */
  image?: number
  /** Price per request (if applicable) */
  request?: number
}

export interface OpenRouterModel {
  id: string
  name: string
  description: string
  provider: string
  pricing: OpenRouterModelPricing
  context_length: number
  max_completion_tokens?: number
  modality?: string
  is_free: boolean
}

export const OPENROUTER_MODELS: OpenRouterModel[] = [
  {
    id: 'x-ai/grok-4.1-fast',
    name: 'xAI: Grok 4.1 Fast',
    description:
      "Grok 4.1 Fast is xAI's best agentic tool calling model that shines in real-world use cases like customer support and deep research. 2M context window.\n\nReasoning can be enabled/disabled using the `reasoning` `enabled` parameter in the API. [Learn more in our docs](https://openrouter.ai/docs/use-cases/reasoning-tokens#controlling-reasoning-tokens)",
    provider: 'x-ai',
    pricing: { prompt: 0.19999999999999998, completion: 0.5, image: 0, request: 0 },
    context_length: 2000000,
    max_completion_tokens: 30000,
    modality: 'text+image->text',
    is_free: false,
  },
  {
    id: 'x-ai/grok-4',
    name: 'xAI: Grok 4',
    description:
      "Grok 4 is xAI's latest reasoning model with a 256k context window. It supports parallel tool calling, structured outputs, and both image and text inputs. Note that reasoning is not exposed, reasoning cannot be disabled, and the reasoning effort cannot be specified. Pricing increases once the total tokens in a given request is greater than 128k tokens. See more details on the [xAI docs](https://docs.x.ai/docs/models/grok-4-0709)",
    provider: 'x-ai',
    pricing: { prompt: 3, completion: 15, image: 0, request: 0 },
    context_length: 256000,
    modality: 'text+image->text',
    is_free: false,
  },
  {
    id: 'google/gemini-3-pro-preview',
    name: 'Google: Gemini 3 Pro Preview',
    description:
      'Gemini 3 Pro is Google’s flagship frontier model for high-precision multimodal reasoning, combining strong performance across text, image, video, audio, and code with a 1M-token context window. Reasoning Details must be preserved when using multi-turn tool calling, see our docs here: https://openrouter.ai/docs/use-cases/reasoning-tokens#preserving-reasoning-blocks. It delivers state-of-the-art benchmark results in general reasoning, STEM problem solving, factual QA, and multimodal understanding, including leading scores on LMArena, GPQA Diamond, MathArena Apex, MMMU-Pro, and Video-MMMU. Interactions emphasize depth and interpretability: the model is designed to infer intent with minimal prompting and produce direct, insight-focused responses.\n\nBuilt for advanced development and agentic workflows, Gemini 3 Pro provides robust tool-calling, long-horizon planning stability, and strong zero-shot generation for complex UI, visualization, and coding tasks. It excels at agentic coding (SWE-Bench Verified, Terminal-Bench 2.0), multimodal analysis, and structured long-form tasks such as research synthesis, planning, and interactive learning experiences. Suitable applications include autonomous agents, coding assistants, multimodal analytics, scientific reasoning, and high-context information processing.',
    provider: 'google',
    pricing: { prompt: 2, completion: 12, image: 8256, request: 0 },
    context_length: 1048576,
    max_completion_tokens: 65536,
    modality: 'text+image->text',
    is_free: false,
  },
  {
    id: 'google/gemini-3-flash-preview',
    name: 'Google: Gemini 3 Flash Preview',
    description:
      'Gemini 3 Flash Preview is a high speed, high value thinking model designed for agentic workflows, multi turn chat, and coding assistance. It delivers near Pro level reasoning and tool use performance with substantially lower latency than larger Gemini variants, making it well suited for interactive development, long running agent loops, and collaborative coding tasks. Compared to Gemini 2.5 Flash, it provides broad quality improvements across reasoning, multimodal understanding, and reliability.\n\nThe model supports a 1M token context window and multimodal inputs including text, images, audio, video, and PDFs, with text output. It includes configurable reasoning via thinking levels (minimal, low, medium, high), structured output, tool use, and automatic context caching. Gemini 3 Flash Preview is optimized for users who want strong reasoning and agentic behavior without the cost or latency of full scale frontier models.',
    provider: 'google',
    pricing: { prompt: 0.5, completion: 3, image: 0, request: 0 },
    context_length: 1048576,
    max_completion_tokens: 65535,
    modality: 'text+image->text',
    is_free: false,
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Google: Gemini 2.5 Pro',
    description:
      'Gemini 2.5 Pro is Google’s state-of-the-art AI model designed for advanced reasoning, coding, mathematics, and scientific tasks. It employs “thinking” capabilities, enabling it to reason through responses with enhanced accuracy and nuanced context handling. Gemini 2.5 Pro achieves top-tier performance on multiple benchmarks, including first-place positioning on the LMArena leaderboard, reflecting superior human-preference alignment and complex problem-solving abilities.',
    provider: 'google',
    pricing: { prompt: 1.25, completion: 10, image: 5160, request: 0 },
    context_length: 1048576,
    max_completion_tokens: 65536,
    modality: 'text+image->text',
    is_free: false,
  },
  {
    id: 'google/gemma-3-12b-it',
    name: 'Google: Gemma 3 12B',
    description:
      'Gemma 3 introduces multimodality, supporting vision-language input and text outputs. It handles context windows up to 128k tokens, understands over 140 languages, and offers improved math, reasoning, and chat capabilities, including structured outputs and function calling. Gemma 3 12B is the second largest in the family of Gemma 3 models after [Gemma 3 27B](google/gemma-3-27b-it)',
    provider: 'google',
    pricing: { prompt: 0.03, completion: 0.09999999999999999, image: 0, request: 0 },
    context_length: 131072,
    max_completion_tokens: 131072,
    modality: 'text+image->text',
    is_free: false,
  },
  {
    id: 'openai/gpt-5.2',
    name: 'OpenAI: GPT-5.2',
    description:
      'GPT-5.2 is the latest frontier-grade model in the GPT-5 series, offering stronger agentic and long context perfomance compared to GPT-5.1. It uses adaptive reasoning to allocate computation dynamically, responding quickly to simple queries while spending more depth on complex tasks.\n\nBuilt for broad task coverage, GPT-5.2 delivers consistent gains across math, coding, sciende, and tool calling workloads, with more coherent long-form answers and improved tool-use reliability.',
    provider: 'openai',
    pricing: { prompt: 1.75, completion: 14 },
    context_length: 400000,
    max_completion_tokens: 128000,
    modality: 'text+image->text',
    is_free: false,
  },
  {
    id: 'openai/gpt-4o',
    name: 'OpenAI: GPT-4o',
    description:
      'GPT-4o ("o" for "omni") is OpenAI\'s latest AI model, supporting both text and image inputs with text outputs. It maintains the intelligence level of [GPT-4 Turbo](/models/openai/gpt-4-turbo) while being twice as fast and 50% more cost-effective. GPT-4o also offers improved performance in processing non-English languages and enhanced visual capabilities.\n\nFor benchmarking against other models, it was briefly called ["im-also-a-good-gpt2-chatbot"](https://twitter.com/LiamFedus/status/1790064963966370209)\n\n#multimodal',
    provider: 'openai',
    pricing: { prompt: 2.5, completion: 10 },
    context_length: 128000,
    max_completion_tokens: 16384,
    modality: 'text+image->text',
    is_free: false,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'OpenAI: GPT-4o-mini',
    description:
      "GPT-4o mini is OpenAI's newest model after [GPT-4 Omni](/models/openai/gpt-4o), supporting both text and image inputs with text outputs.\n\nAs their most advanced small model, it is many multiples more affordable than other recent frontier models, and more than 60% cheaper than [GPT-3.5 Turbo](/models/openai/gpt-3.5-turbo). It maintains SOTA intelligence, while being significantly more cost-effective.\n\nGPT-4o mini achieves an 82% score on MMLU and presently ranks higher than GPT-4 on chat preferences [common leaderboards](https://arena.lmsys.org/).\n\nCheck out the [launch announcement](https://openai.com/index/gpt-4o-mini-advancing-cost-efficient-intelligence/) to learn more.\n\n#multimodal",
    provider: 'openai',
    pricing: { prompt: 0.15, completion: 0.6 },
    context_length: 128000,
    max_completion_tokens: 16384,
    modality: 'text+image->text',
    is_free: false,
  },
  {
    id: 'anthropic/claude-opus-4.5',
    name: 'Anthropic: Claude Opus 4.5',
    description:
      'Claude Opus 4.5 is Anthropic’s frontier reasoning model optimized for complex software engineering, agentic workflows, and long-horizon computer use. It offers strong multimodal capabilities, competitive performance across real-world coding and reasoning benchmarks, and improved robustness to prompt injection. The model is designed to operate efficiently across varied effort levels, enabling developers to trade off speed, depth, and token usage depending on task requirements. It comes with a new parameter to control token efficiency, which can be accessed using the OpenRouter Verbosity parameter with low, medium, or high.\n\nOpus 4.5 supports advanced tool use, extended context management, and coordinated multi-agent setups, making it well-suited for autonomous research, debugging, multi-step planning, and spreadsheet/browser manipulation. It delivers substantial gains in structured reasoning, execution reliability, and alignment compared to prior Opus generations, while reducing token overhead and improving performance on long-running tasks.',
    provider: 'anthropic',
    pricing: { prompt: 5, completion: 25, image: 0, request: 0 },
    context_length: 200000,
    max_completion_tokens: 64000,
    modality: 'text+image->text',
    is_free: false,
  },
  {
    id: 'anthropic/claude-opus-4.1',
    name: 'Anthropic: Claude Opus 4.1',
    description:
      'Claude Opus 4.1 is an updated version of Anthropic’s flagship model, offering improved performance in coding, reasoning, and agentic tasks. It achieves 74.5% on SWE-bench Verified and shows notable gains in multi-file code refactoring, debugging precision, and detail-oriented reasoning. The model supports extended thinking up to 64K tokens and is optimized for tasks involving research, data analysis, and tool-assisted reasoning.',
    provider: 'anthropic',
    pricing: { prompt: 15, completion: 75, image: 24000, request: 0 },
    context_length: 200000,
    max_completion_tokens: 32000,
    modality: 'text+image->text',
    is_free: false,
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Anthropic: Claude Sonnet 4.5',
    description:
      'Claude Sonnet 4.5 is Anthropic’s most advanced Sonnet model to date, optimized for real-world agents and coding workflows. It delivers state-of-the-art performance on coding benchmarks such as SWE-bench Verified, with improvements across system design, code security, and specification adherence. The model is designed for extended autonomous operation, maintaining task continuity across sessions and providing fact-based progress tracking.\n\nSonnet 4.5 also introduces stronger agentic capabilities, including improved tool orchestration, speculative parallel execution, and more efficient context and memory management. With enhanced context tracking and awareness of token usage across tool calls, it is particularly well-suited for multi-context and long-running workflows. Use cases span software engineering, cybersecurity, financial analysis, research agents, and other domains requiring sustained reasoning and tool use.',
    provider: 'anthropic',
    pricing: { prompt: 3, completion: 15, image: 4800, request: 0 },
    context_length: 1000000,
    max_completion_tokens: 64000,
    modality: 'text+image->text',
    is_free: false,
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Anthropic: Claude Haiku 4.5',
    description:
      'Claude Haiku 4.5 is Anthropic’s fastest and most efficient model, delivering near-frontier intelligence at a fraction of the cost and latency of larger Claude models. Matching Claude Sonnet 4’s performance across reasoning, coding, and computer-use tasks, Haiku 4.5 brings frontier-level capability to real-time and high-volume applications.\n\nIt introduces extended thinking to the Haiku line; enabling controllable reasoning depth, summarized or interleaved thought output, and tool-assisted workflows with full support for coding, bash, web search, and computer-use tools. Scoring >73% on SWE-bench Verified, Haiku 4.5 ranks among the world’s best coding models while maintaining exceptional responsiveness for sub-agents, parallelized execution, and scaled deployment.',
    provider: 'anthropic',
    pricing: { prompt: 1, completion: 5, image: 0, request: 0 },
    context_length: 200000,
    max_completion_tokens: 64000,
    modality: 'text+image->text',
    is_free: false,
  },
  {
    id: 'amazon/nova-premier-v1',
    name: 'Amazon: Nova Premier 1.0',
    description:
      'Amazon Nova Premier is the most capable of Amazon’s multimodal models for complex reasoning tasks and for use as the best teacher for distilling custom models.',
    provider: 'amazon',
    pricing: { prompt: 2.5, completion: 12.5, image: 0, request: 0 },
    context_length: 1000000,
    max_completion_tokens: 32000,
    modality: 'text+image->text',
    is_free: false,
  },
  {
    id: 'allenai/olmo-3-32b-think',
    name: 'AllenAI: Olmo 3 32B Think',
    description:
      'Olmo 3 32B Think is a large-scale, 32-billion-parameter model purpose-built for deep reasoning, complex logic chains and advanced instruction-following scenarios. Its capacity enables strong performance on demanding evaluation tasks and highly nuanced conversational reasoning. Developed by Ai2 under the Apache 2.0 license, Olmo 3 32B Think embodies the Olmo initiative’s commitment to openness, offering full transparency across weights, code and training methodology.',
    provider: 'allenai',
    pricing: { prompt: 0.15, completion: 0.5, image: 0, request: 0 },
    context_length: 65536,
    max_completion_tokens: 65536,
    modality: 'text->text',
    is_free: false,
  },
  {
    id: 'allenai/olmo-3-7b-think',
    name: 'AllenAI: Olmo 3 7B Think',
    description:
      'Olmo 3 7B Think is a research-oriented language model in the Olmo family designed for advanced reasoning and instruction-driven tasks. It excels at multi-step problem solving, logical inference, and maintaining coherent conversational context. Developed by Ai2 under the Apache 2.0 license, Olmo 3 7B Think supports transparent, fully open experimentation and provides a lightweight yet capable foundation for academic research and practical NLP workflows.',
    provider: 'allenai',
    pricing: { prompt: 0.12, completion: 0.19999999999999998, image: 0, request: 0 },
    context_length: 65536,
    max_completion_tokens: 65536,
    modality: 'text->text',
    is_free: false,
  },
  {
    id: 'allenai/olmo-3-7b-instruct',
    name: 'AllenAI: Olmo 3 7B Instruct',
    description:
      'Olmo 3 7B Instruct is a supervised instruction-fine-tuned variant of the Olmo 3 7B base model, optimized for instruction-following, question-answering, and natural conversational dialogue. By leveraging high-quality instruction data and an open training pipeline, it delivers strong performance across everyday NLP tasks while remaining accessible and easy to integrate. Developed by Ai2 under the Apache 2.0 license, the model offers a transparent, community-friendly option for instruction-driven applications.',
    provider: 'allenai',
    pricing: { prompt: 0.09999999999999999, completion: 0.19999999999999998, image: 0, request: 0 },
    context_length: 65536,
    max_completion_tokens: 65536,
    modality: 'text->text',
    is_free: false,
  },
  {
    id: 'nvidia/nemotron-nano-9b-v2',
    name: 'NVIDIA: Nemotron Nano 9B V2',
    description:
      "NVIDIA-Nemotron-Nano-9B-v2 is a large language model (LLM) trained from scratch by NVIDIA, and designed as a unified model for both reasoning and non-reasoning tasks. It responds to user queries and tasks by first generating a reasoning trace and then concluding with a final response. \n\nThe model's reasoning capabilities can be controlled via a system prompt. If the user prefers the model to provide its final answer without intermediate reasoning traces, it can be configured to do so.",
    provider: 'nvidia',
    pricing: { prompt: 0.04, completion: 0.16, image: 0, request: 0 },
    context_length: 131072,
    modality: 'text->text',
    is_free: false,
  },
  {
    id: 'moonshotai/kimi-k2-thinking',
    name: 'MoonshotAI: Kimi K2 Thinking',
    description:
      'Kimi K2 Thinking is Moonshot AI’s most advanced open reasoning model to date, extending the K2 series into agentic, long-horizon reasoning. Built on the trillion-parameter Mixture-of-Experts (MoE) architecture introduced in Kimi K2, it activates 32 billion parameters per forward pass and supports 256 k-token context windows. The model is optimized for persistent step-by-step thought, dynamic tool invocation, and complex reasoning workflows that span hundreds of turns. It interleaves step-by-step reasoning with tool use, enabling autonomous research, coding, and writing that can persist for hundreds of sequential actions without drift.\n\nIt sets new open-source benchmarks on HLE, BrowseComp, SWE-Multilingual, and LiveCodeBench, while maintaining stable multi-agent behavior through 200–300 tool calls. Built on a large-scale MoE architecture with MuonClip optimization, it combines strong reasoning depth with high inference efficiency for demanding agentic and analytical tasks.',
    provider: 'moonshotai',
    pricing: { prompt: 0.39999999999999997, completion: 1.75, image: 0, request: 0 },
    context_length: 262144,
    max_completion_tokens: 65535,
    modality: 'text->text',
    is_free: false,
  },
  {
    id: 'qwen/qwen3-32b',
    name: 'Qwen: Qwen3 32B',
    description:
      'Qwen3-32B is a dense 32.8B parameter causal language model from the Qwen3 series, optimized for both complex reasoning and efficient dialogue. It supports seamless switching between a "thinking" mode for tasks like math, coding, and logical inference, and a "non-thinking" mode for faster, general-purpose conversation. The model demonstrates strong performance in instruction-following, agent tool use, creative writing, and multilingual tasks across 100+ languages and dialects. It natively handles 32K token contexts and can extend to 131K tokens using YaRN-based scaling. ',
    provider: 'qwen',
    pricing: { prompt: 0.08, completion: 0.24, image: 0, request: 0 },
    context_length: 40960,
    max_completion_tokens: 40960,
    modality: 'text->text',
    is_free: false,
  },
  {
    id: 'qwen/qwen3-14b',
    name: 'Qwen: Qwen3 14B',
    description:
      'Qwen3-14B is a dense 14.8B parameter causal language model from the Qwen3 series, designed for both complex reasoning and efficient dialogue. It supports seamless switching between a "thinking" mode for tasks like math, programming, and logical inference, and a "non-thinking" mode for general-purpose conversation. The model is fine-tuned for instruction-following, agent tool use, creative writing, and multilingual tasks across 100+ languages and dialects. It natively handles 32K token contexts and can extend to 131K tokens using YaRN-based scaling.',
    provider: 'qwen',
    pricing: { prompt: 0.049999999999999996, completion: 0.22, image: 0, request: 0 },
    context_length: 40960,
    max_completion_tokens: 40960,
    modality: 'text->text',
    is_free: false,
  },
  {
    id: 'qwen/qwen3-8b',
    name: 'Qwen: Qwen3 8B',
    description:
      'Qwen3-8B is a dense 8.2B parameter causal language model from the Qwen3 series, designed for both reasoning-heavy tasks and efficient dialogue. It supports seamless switching between "thinking" mode for math, coding, and logical inference, and "non-thinking" mode for general conversation. The model is fine-tuned for instruction-following, agent integration, creative writing, and multilingual use across 100+ languages and dialects. It natively supports a 32K token context window and can extend to 131K tokens with YaRN scaling.',
    provider: 'qwen',
    pricing: { prompt: 0.049999999999999996, completion: 0.25, image: 0, request: 0 },
    context_length: 32000,
    max_completion_tokens: 8192,
    modality: 'text->text',
    is_free: false,
  },
  {
    id: 'z-ai/glm-4.7',
    name: 'Z.AI: GLM 4.7',
    description:
      'GLM-4.7 is Z.AI’s latest flagship model, featuring upgrades in two key areas: enhanced programming capabilities and more stable multi-step reasoning/execution. It demonstrates significant improvements in executing complex agent tasks while delivering more natural conversational experiences and superior front-end aesthetics.',
    provider: 'z-ai',
    pricing: { prompt: 0.39999999999999997, completion: 1.5, image: 0, request: 0 },
    context_length: 202752,
    max_completion_tokens: 65535,
    modality: 'text->text',
    is_free: false,
  },
  {
    id: 'deepseek/deepseek-v3.2',
    name: 'DeepSeek: DeepSeek V3.2',
    description:
      'DeepSeek-V3.2 is a large language model designed to harmonize high computational efficiency with strong reasoning and agentic tool-use performance. It introduces DeepSeek Sparse Attention (DSA), a fine-grained sparse attention mechanism that reduces training and inference cost while preserving quality in long-context scenarios. A scalable reinforcement learning post-training framework further improves reasoning, with reported performance in the GPT-5 class, and the model has demonstrated gold-medal results on the 2025 IMO and IOI. V3.2 also uses a large-scale agentic task synthesis pipeline to better integrate reasoning into tool-use settings, boosting compliance and generalization in interactive environments.\n\nUsers can control the reasoning behaviour with the `reasoning` `enabled` boolean. [Learn more in our docs](https://openrouter.ai/docs/use-cases/reasoning-tokens#enable-reasoning-with-default-config)',
    provider: 'deepseek',
    pricing: { prompt: 0.25, completion: 0.38, image: 0, request: 0 },
    context_length: 163840,
    max_completion_tokens: 65536,
    modality: 'text->text',
    is_free: false,
  },
  {
    id: 'deepseek/deepseek-v3.2-speciale',
    name: 'DeepSeek: DeepSeek V3.2 Speciale',
    description:
      'DeepSeek-V3.2-Speciale is a high-compute variant of DeepSeek-V3.2 optimized for maximum reasoning and agentic performance. It builds on DeepSeek Sparse Attention (DSA) for efficient long-context processing, then scales post-training reinforcement learning to push capability beyond the base model. Reported evaluations place Speciale ahead of GPT-5 on difficult reasoning workloads, with proficiency comparable to Gemini-3.0-Pro, while retaining strong coding and tool-use reliability. Like V3.2, it benefits from a large-scale agentic task synthesis pipeline that improves compliance and generalization in interactive environments.',
    provider: 'deepseek',
    pricing: { prompt: 0.27, completion: 0.41, image: 0, request: 0 },
    context_length: 163840,
    max_completion_tokens: 65536,
    modality: 'text->text',
    is_free: false,
  },
  {
    id: 'minimax/minimax-m2.1',
    name: 'MiniMax: MiniMax M2.1',
    description:
      "MiniMax-M2.1 is a lightweight, state-of-the-art large language model optimized for coding, agentic workflows, and modern application development. With only 10 billion activated parameters, it delivers a major jump in real-world capability while maintaining exceptional latency, scalability, and cost efficiency.\n\nCompared to its predecessor, M2.1 delivers cleaner, more concise outputs and faster perceived response times. It shows leading multilingual coding performance across major systems and application languages, achieving 49.4% on Multi-SWE-Bench and 72.5% on SWE-Bench Multilingual, and serves as a versatile agent “brain” for IDEs, coding tools, and general-purpose assistance.\n\nTo avoid degrading this model's performance, MiniMax highly recommends preserving reasoning between turns. Learn more about using reasoning_details to pass back reasoning in our [docs](https://openrouter.ai/docs/use-cases/reasoning-tokens#preserving-reasoning-blocks).",
    provider: 'minimax',
    pricing: { prompt: 0.27, completion: 1.12, image: 0, request: 0 },
    context_length: 196608,
    max_completion_tokens: 65536,
    modality: 'text->text',
    is_free: false,
  },
]
