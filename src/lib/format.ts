import { NO_GESTURE_LABEL } from './config'

/** Human-friendly label text; maps the synthetic no_gesture class to localized copy. */
export function prettyLabel(label: string, noGestureText: string): string {
  if (label === NO_GESTURE_LABEL) return noGestureText
  return label.replace(/[_-]+/g, ' ')
}

/** Format a [0,1] score as a percentage string, e.g. `0.873` -> `87.3%`. */
export function formatPercent(score: number, digits = 1): string {
  return `${(score * 100).toFixed(digits)}%`
}
