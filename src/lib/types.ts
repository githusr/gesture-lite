// ---------------------------------------------------------------------------
// Shared types used across the main thread, the inference worker and the UI.
// ---------------------------------------------------------------------------

/** Memory layout of the model's input tensor. */
export type TensorLayout = 'nchw' | 'nhwc'

/** Channel order the model expects. `mean`/`std` are interpreted in THIS order. */
export type ChannelOrder = 'rgb' | 'bgr'

/**
 * Describes how to turn a cropped hand image into the tensor a specific gesture
 * model expects. Loaded at runtime from `public/models/model.config.json` so the
 * model can be swapped without touching code. Any field may be omitted; missing
 * fields fall back to {@link DEFAULT_MODEL_CONFIG}.
 *
 * Preprocessing math (per pixel, per channel):
 *   value      = pixel_uint8 * scale          // scale 1/255 => [0,1]
 *   normalized = (value - mean[c]) / std[c]    // mean/std in `channelOrder`
 */
export interface ModelConfig {
  /** Square input edge length in pixels, e.g. 224. */
  inputSize: number
  /** Multiplier applied to the raw 0–255 pixel value. Usually 1/255. */
  scale: number
  /** Per-channel mean, given in `channelOrder`. */
  mean: [number, number, number]
  /** Per-channel std, given in `channelOrder`. */
  std: [number, number, number]
  /** Channel order the tensor is packed in. */
  channelOrder: ChannelOrder
  /** Tensor memory layout. */
  layout: TensorLayout
  /** Apply softmax to the raw model output (set false if it already outputs probabilities). */
  applySoftmax: boolean
  /** Extra padding around the hand bounding box, as a fraction of its size. */
  roiPadding: number
  /** Optional explicit input tensor name (else the model's first input is used). */
  inputName?: string
  /** Optional explicit output tensor name (else the model's first output is used). */
  outputName?: string
}

/** A raw RGBA pixel buffer — the cross-thread currency between UI and worker. */
export interface RGBAImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

/** A bounding box in pixel coordinates of the source video frame. */
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** A single class prediction. */
export interface Prediction {
  index: number
  label: string
  score: number
}

/** The smoothed, display-ready classification state for one moment in time. */
export interface SmoothedResult {
  /** Committed label (may be the synthetic `no_gesture` label). */
  label: string
  /** Confidence of the committed label in [0, 1]. */
  score: number
  /** Whether a gesture is actively recognised (false => no_gesture). */
  active: boolean
  /** Top-K raw model predictions, sorted by score descending. */
  top: Prediction[]
}

/** Stable, translatable camera-failure reasons surfaced by the pipeline. */
export type CameraErrorCode =
  | 'insecure-context'
  | 'api-unavailable'
  | 'permission-denied'
  | 'not-found'
  | 'in-use'
  | 'unknown'

/** Stable, translatable model-load failure reasons. */
export type ModelErrorCode = 'not-loaded' | 'failed'

// ---- Worker protocol ------------------------------------------------------

export type WorkerRequest =
  | { type: 'init'; modelUrl: string; config: ModelConfig }
  | { type: 'infer'; id: number; image: RGBAImage }
  | { type: 'dispose' }

export type WorkerResponse =
  | { type: 'ready'; inputName: string; outputName: string }
  | { type: 'result'; id: number; probs: ArrayBuffer }
  | { type: 'error'; phase: 'init' | 'infer'; message: string; id?: number }
