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

{"solution": "RRUU"}

The "solution" field should contain only move characters: U (up), D (down), L (left), R (right).`

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
  "solution": "<moves>"
}
\`\`\`

Rules:
- The "reasoning" field should contain your step-by-step analysis
- The "solution" field should contain only move characters: U (up), D (down), L (left), R (right)
- Example solution: "RRDDLUUR"

IMPORTANT: Your response must be valid JSON. Do not include any text outside the JSON object.`

/**
 * Transform a parsed solution generation response to training format.
 * Converts { reasoning, solution } to <think>reasoning</think>\n\n{"solution": "..."}
 */
export function formatTrainingResponse(reasoning: string, solution: string): string {
  return `<think>Let me put my thinking cap on and analyze this problem step by step.
${reasoning}</think>

{"solution": "${solution}"}`
}

/**
 * Parse a training format response to extract the solution.
 * Extracts solution from <think>...</think>\n\n{"solution": "..."} format.
 */
export function parseTrainingResponse(
  response: string,
): { reasoning: string; solution: string } | null {
  try {
    // Extract reasoning from <think> tags
    const thinkMatch = response.match(/<think>([\s\S]*?)<\/think>/)
    if (!thinkMatch) return null
    const reasoning = thinkMatch[1].trim()

    // Extract JSON after </think>
    const jsonPart = response.slice(response.indexOf('</think>') + 8).trim()
    const parsed = JSON.parse(jsonPart)

    if (typeof parsed.solution !== 'string') return null

    return { reasoning, solution: parsed.solution }
  } catch {
    return null
  }
}
