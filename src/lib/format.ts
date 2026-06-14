import { NO_GESTURE_LABEL, NO_GESTURE_TEXT } from './config'

/** Human-friendly label text (maps the synthetic no_gesture class to Chinese). */
export function prettyLabel(label: string): string {
  if (label === NO_GESTURE_LABEL) return NO_GESTURE_TEXT
  return label.replace(/[_-]+/g, ' ')
}

/** Format a [0,1] score as a percentage string, e.g. `0.873` -> `87.3%`. */
export function formatPercent(score: number, digits = 1): string {
  return `${(score * 100).toFixed(digits)}%`
}
