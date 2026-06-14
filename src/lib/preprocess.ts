import type { Box, ModelConfig, RGBAImage } from './types'

// ---------------------------------------------------------------------------
// Preprocessing pipeline: landmarks -> ROI box -> crop+resize -> tensor.
//
// The pieces are intentionally split by *where* they run:
//   - computeRoi / RoiExtractor : main thread (needs the live video + a canvas)
//   - imageDataToTensor / softmax : pure math, runs inside the inference worker
// ---------------------------------------------------------------------------

export interface NormalizedPoint {
  x: number
  y: number
}

/**
 * Build a padded, square ROI (in source pixels) that encloses all landmarks.
 *
 * Landmarks are normalised ([0,1]) MediaPipe coordinates. We square the box so
 * that resizing to the model's square input does not distort the hand, then
 * clamp it into the frame.
 */
export function computeRoi(
  landmarks: readonly NormalizedPoint[],
  videoW: number,
  videoH: number,
  padding: number,
): Box {
  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }

  const x0 = minX * videoW
  const y0 = minY * videoH
  const x1 = maxX * videoW
  const y1 = maxY * videoH

  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const boxW = x1 - x0
  const boxH = y1 - y0

  // Square side, expanded by padding on every edge.
  let side = Math.max(boxW, boxH) * (1 + padding * 2)
  side = Math.min(side, videoW, videoH)

  let x = cx - side / 2
  let y = cy - side / 2
  // Keep the (square) box fully inside the frame.
  x = Math.max(0, Math.min(x, videoW - side))
  y = Math.max(0, Math.min(y, videoH - side))

  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(side),
    h: Math.round(side),
  }
}

/**
 * Reusable canvas that crops an arbitrary ROI out of a video frame and resizes
 * it to the model's square input, returning raw RGBA pixels. Lives on the main
 * thread; the resulting {@link RGBAImage} is transferred to the worker.
 */
export class RoiExtractor {
  private canvas: OffscreenCanvas | HTMLCanvasElement
  private ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
  private size: number

  constructor(size: number) {
    this.size = size
    if (typeof OffscreenCanvas !== 'undefined') {
      this.canvas = new OffscreenCanvas(size, size)
    } else {
      const c = document.createElement('canvas')
      c.width = size
      c.height = size
      this.canvas = c
    }
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('2D canvas context is not available')
    this.ctx = ctx as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
  }

  /** Adjust the output resolution if the model config changes at runtime. */
  resize(size: number): void {
    if (size === this.size) return
    this.size = size
    this.canvas.width = size
    this.canvas.height = size
  }

  /** Crop `box` from `source` and return it resized to `size`×`size` RGBA. */
  extract(source: CanvasImageSource, box: Box): RGBAImage {
    this.ctx.drawImage(source, box.x, box.y, box.w, box.h, 0, 0, this.size, this.size)
    const img = this.ctx.getImageData(0, 0, this.size, this.size)
    return { data: img.data, width: img.width, height: img.height }
  }
}

/**
 * Convert an RGBA image into a normalised Float32 tensor.
 *
 * Output ordering honours {@link ModelConfig.layout} (NCHW vs NHWC) and
 * {@link ModelConfig.channelOrder} (RGB vs BGR). `mean`/`std` are applied in the
 * configured channel order.
 */
export function imageDataToTensor(img: RGBAImage, cfg: ModelConfig): Float32Array {
  const { data, width, height } = img
  const pixels = width * height
  const out = new Float32Array(pixels * 3)

  const [m0, m1, m2] = cfg.mean
  const [s0, s1, s2] = cfg.std
  const scale = cfg.scale
  const bgr = cfg.channelOrder === 'bgr'
  const nchw = cfg.layout === 'nchw'

  for (let i = 0; i < pixels; i++) {
    const r = data[i * 4] * scale
    const g = data[i * 4 + 1] * scale
    const b = data[i * 4 + 2] * scale

    // c0,c1,c2 follow the configured channel order.
    const c0 = bgr ? b : r
    const c2 = bgr ? r : b
    const n0 = (c0 - m0) / s0
    const n1 = (g - m1) / s1
    const n2 = (c2 - m2) / s2

    if (nchw) {
      out[i] = n0
      out[pixels + i] = n1
      out[2 * pixels + i] = n2
    } else {
      out[i * 3] = n0
      out[i * 3 + 1] = n1
      out[i * 3 + 2] = n2
    }
  }
  return out
}

/** Numerically stable softmax over a 1-D logit vector. */
export function softmax(logits: Float32Array): Float32Array {
  let max = -Infinity
  for (let i = 0; i < logits.length; i++) if (logits[i] > max) max = logits[i]

  let sum = 0
  const out = new Float32Array(logits.length)
  for (let i = 0; i < logits.length; i++) {
    const e = Math.exp(logits[i] - max)
    out[i] = e
    sum += e
  }
  const inv = sum > 0 ? 1 / sum : 0
  for (let i = 0; i < out.length; i++) out[i] *= inv
  return out
}
