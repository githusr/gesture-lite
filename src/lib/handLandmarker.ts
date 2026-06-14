import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision'
import { paths } from './config'

export type { HandLandmarkerResult }

export interface HandLandmarkerOptions {
  numHands: number
  minDetectionConfidence: number
}

/**
 * Create a MediaPipe Hand Landmarker in VIDEO mode. Runs on the main thread
 * (it manages its own WASM/GPU internally). Tries the GPU delegate first and
 * transparently falls back to CPU on devices where GPU init fails.
 */
export async function createHandLandmarker(
  opts: HandLandmarkerOptions,
): Promise<HandLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(paths.mediapipeWasm())

  const build = (delegate: 'GPU' | 'CPU') =>
    HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: paths.handLandmarker(),
        delegate,
      },
      runningMode: 'VIDEO',
      numHands: opts.numHands,
      minHandDetectionConfidence: opts.minDetectionConfidence,
      minHandPresenceConfidence: opts.minDetectionConfidence,
      minTrackingConfidence: opts.minDetectionConfidence,
    })

  try {
    return await build('GPU')
  } catch {
    return await build('CPU')
  }
}

/** Standard MediaPipe 21-point hand skeleton, used for the overlay. */
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [5, 9], [9, 10], [10, 11], [11, 12], // middle
  [9, 13], [13, 14], [14, 15], [15, 16], // ring
  [13, 17], [17, 18], [18, 19], [19, 20], // pinky
  [0, 17], // palm base
]
