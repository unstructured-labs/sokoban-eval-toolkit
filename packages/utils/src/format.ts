/**
 * Format a number with commas for thousands separators.
 * e.g., 4349 -> "4,349"
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US')
}

/**
 * Format milliseconds to a human-readable duration.
 * - Under 1000ms: "500ms"
 * - 1000ms to 60000ms: "1.5s"
 * - Over 60000ms: "2m 30s" or "2.5m"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }

  const seconds = ms / 1000

  if (seconds < 60) {
    // Show one decimal place for seconds
    return `${seconds.toFixed(1)}s`
  }

  const minutes = seconds / 60

  if (minutes < 60) {
    // Show one decimal place for minutes
    return `${minutes.toFixed(1)}m`
  }

  // For very long durations, show hours and minutes
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = Math.round(minutes % 60)
  return `${hours}h ${remainingMinutes}m`
}

/**
 * Format a cost value as USD.
 * e.g., 0.0528 -> "$0.0528"
 */
export function formatCost(cost: number): string {
  // Use more decimal places for small amounts
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`
  }
  if (cost < 1) {
    return `$${cost.toFixed(3)}`
  }
  return `$${cost.toFixed(2)}`
}
