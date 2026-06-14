import type { ModelConfig } from './types'

/**
 * Default preprocessing assumptions (ImageNet-style normalisation, 224×224,
 * RGB, NCHW). Overridden by `public/models/model.config.json` when present.
 */
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  inputSize: 224,
  scale: 1 / 255,
  mean: [0.485, 0.456, 0.406],
  std: [0.229, 0.224, 0.225],
  channelOrder: 'rgb',
  layout: 'nchw',
  applySoftmax: true,
  roiPadding: 0.3,
}

/** Synthetic label shown when no hand / no confident gesture is present. */
export const NO_GESTURE_LABEL = 'no_gesture'

// ---- Asset URL helpers ----------------------------------------------------
//
// `import.meta.env.BASE_URL` is `./` for this project (see vite.config.ts), so
// we resolve every runtime asset against the current document URL. This keeps
// the build working when served from a sub-path (GitHub Pages, etc.) and yields
// absolute URLs that are safe to hand to a worker / FilesetResolver.

const BASE = import.meta.env.BASE_URL

function asset(path: string): string {
  return new URL(BASE + path, document.baseURI).href
}

export const paths = {
  model: () => asset('models/gesture.onnx'),
  labels: () => asset('models/labels.json'),
  modelConfig: () => asset('models/model.config.json'),
  handLandmarker: () => asset('models/hand_landmarker.task'),
  /** Directory FilesetResolver loads the MediaPipe vision WASM from. */
  mediapipeWasm: () => asset('wasm/mediapipe'),
}

// ---- Default runtime settings --------------------------------------------

export interface Settings {
  facingMode: 'user' | 'environment'
  /** MediaPipe minimum hand-detection confidence. */
  detectionConfidence: number
  /** Number of recent inferences averaged for smoothing. */
  smoothingWindow: number
  /** Minimum smoothed score required to commit a gesture (else no_gesture). */
  scoreThreshold: number
  /** Fraction of recent frames that must contain a hand to stay "active". */
  presenceRatio: number
  showLandmarks: boolean
  mirror: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  facingMode: 'user',
  detectionConfidence: 0.5,
  smoothingWindow: 8,
  scoreThreshold: 0.55,
  presenceRatio: 0.4,
  showLandmarks: false,
  mirror: true,
}

export const TOP_K = 3
