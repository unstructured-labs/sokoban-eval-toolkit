/**
 * Shared prompt constants for puzzle generation and solution scripts.
 *
 * Two-phase approach:
 * 1. Solution Generation: LLM outputs JSON with reasoning + solution (easy to parse/validate)
 * 2. Training Data: Transformed to <think> tags + JSON solution (for SFT)
 *
 * The eval prompts tell the model what format to produce during inference,
 * which matches the transformed training data format.
 */

/**
 * Output format instructions for eval prompts.
 * This is what we ask the model to produce during evaluation/inference.
 * Matches the transformed training data format.
 */
export const EVAL_OUTPUT_FORMAT_INSTRUCTIONS = `## Output Format
Think through the problem step by step inside <think> tags, then provide your solution as JSON.

Example:
<think>
Let me analyze this. The player is at (3,2) and needs to reach (1,4).
That's 2 rows up and 2 columns right. No walls block this path.
So I'll move: right, right, up, up.
</think>

{"solution": ["RIGHT", "RIGHT", "UP", "UP"]}

The "solution" field should be an array of moves. Valid moves: "UP", "DOWN", "LEFT", "RIGHT".`

/**
 * Output format instructions for solution generation.
 * Used when generating training data with LLMs - produces JSON that's easy to parse.
 * The output is then transformed to <think> + JSON format for training.
 */
export const SOLUTION_GENERATION_FORMAT_INSTRUCTIONS = `## Output Format
Provide your answer as a JSON object with reasoning and solution:

\`\`\`json
{
  "reasoning": "<your step-by-step reasoning>",
  "solution": ["UP", "DOWN", "LEFT", "RIGHT"]
}
\`\`\`

Rules:
- The "reasoning" field should contain your step-by-step analysis
- The "solution" field should be an array of moves. Valid moves: "UP", "DOWN", "LEFT", "RIGHT"
- Example solution: ["RIGHT", "RIGHT", "DOWN", "DOWN", "LEFT", "UP", "UP", "RIGHT"]

IMPORTANT: Your response must be valid JSON. Do not include any text outside the JSON object.`

export type MoveDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

/**
 * Transform a parsed solution generation response to training format.
 * Converts { reasoning, solution } to <think>reasoning</think>\n\n{"solution": [...]}
 */
export function formatTrainingResponse(reasoning: string, solution: MoveDirection[]): string {
  return `<think>Let me put my thinking cap on and analyze this problem step by step.
${reasoning}</think>

{"solution": ${JSON.stringify(solution)}}`
}

const VALID_MOVES: MoveDirection[] = ['UP', 'DOWN', 'LEFT', 'RIGHT']

/**
 * Parse a training format response to extract the solution.
 * Extracts solution from <think>...</think>\n\n{"solution": [...]} format.
 */
export function parseTrainingResponse(
  response: string,
): { reasoning: string; solution: MoveDirection[] } | null {
  try {
    // Extract reasoning from <think> tags
    const thinkMatch = response.match(/<think>([\s\S]*?)<\/think>/)
    if (!thinkMatch) return null
    const reasoning = thinkMatch[1].trim()

    // Extract JSON after </think>
    const jsonPart = response.slice(response.indexOf('</think>') + 8).trim()
    const parsed = JSON.parse(jsonPart)

    if (!Array.isArray(parsed.solution)) return null

    // Validate all moves are valid MoveDirection values
    for (const move of parsed.solution) {
      if (!VALID_MOVES.includes(move)) return null
    }

    return { reasoning, solution: parsed.solution as MoveDirection[] }
  } catch {
    return null
  }
}
