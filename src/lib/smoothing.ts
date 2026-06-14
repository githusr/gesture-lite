import { NO_GESTURE_LABEL } from './config'
import type { Prediction, SmoothedResult } from './types'

export interface SmootherOptions {
  /** Number of recent inference results kept in the averaging window. */
  windowSize: number
  /** Minimum averaged score to commit a gesture (else -> no_gesture). */
  scoreThreshold: number
  /** Fraction of recent frames that must contain a hand to stay active. */
  presenceRatio: number
  /** How many predictions to surface in the Top-K list. */
  topK: number
  /** Class label names (index-aligned to the model output). */
  labels: string[]
}

/**
 * Temporal smoother that turns a noisy per-frame probability stream into a
 * stable, display-ready {@link SmoothedResult}.
 *
 * Each frame contributes one entry to a fixed-size ring buffer: a probability
 * vector when a hand was classified, or `null` when no hand was present. The
 * smoothed output is the mean of the present vectors, with two gates that both
 * collapse to `no_gesture`:
 *   1. presence — too few recent frames had a hand,
 *   2. confidence — the averaged top score is below `scoreThreshold`.
 *
 * Options are public and may be mutated live from the settings UI.
 */
export class PredictionSmoother {
  windowSize: number
  scoreThreshold: number
  presenceRatio: number
  topK: number
  labels: string[]

  private window: (Float32Array | null)[] = []

  constructor(opts: SmootherOptions) {
    this.windowSize = opts.windowSize
    this.scoreThreshold = opts.scoreThreshold
    this.presenceRatio = opts.presenceRatio
    this.topK = opts.topK
    this.labels = opts.labels
  }

  reset(): void {
    this.window = []
  }

  /** Feed one frame: a probability vector, or `null` for "no hand". */
  push(probs: Float32Array | null): void {
    this.window.push(probs)
    while (this.window.length > Math.max(1, this.windowSize)) this.window.shift()
  }

  /** Compute the current smoothed result from the window. */
  result(): SmoothedResult {
    const total = this.window.length
    const present = this.window.filter((p): p is Float32Array => p !== null)
    const presence = total > 0 ? present.length / total : 0

    if (present.length === 0 || presence < this.presenceRatio) {
      return { label: NO_GESTURE_LABEL, score: 0, active: false, top: [] }
    }

    const n = present[0].length
    const avg = new Float32Array(n)
    for (const v of present) {
      for (let i = 0; i < n; i++) avg[i] += v[i]
    }
    for (let i = 0; i < n; i++) avg[i] /= present.length

    const top = this.topPredictions(avg)
    const best = top[0]

    if (!best || best.score < this.scoreThreshold) {
      // Hand is present but the model is not confident enough to commit.
      return { label: NO_GESTURE_LABEL, score: best?.score ?? 0, active: false, top }
    }
    return { label: best.label, score: best.score, active: true, top }
  }

  private topPredictions(avg: Float32Array): Prediction[] {
    const indices = Array.from(avg.keys())
    indices.sort((a, b) => avg[b] - avg[a])
    return indices.slice(0, this.topK).map((index) => ({
      index,
      label: this.labels[index] ?? `class_${index}`,
      score: avg[index],
    }))
  }
}
