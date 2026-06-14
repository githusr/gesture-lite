import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_MODEL_CONFIG,
  NO_GESTURE_LABEL,
  TOP_K,
  paths,
  type Settings,
} from '../lib/config'
import { GestureClassifier } from '../lib/gestureClassifier'
import {
  HAND_CONNECTIONS,
  createHandLandmarker,
  type HandLandmarkerResult,
} from '../lib/handLandmarker'
import { RoiExtractor, computeRoi, type NormalizedPoint } from '../lib/preprocess'
import { PredictionSmoother } from '../lib/smoothing'
import type { Box, ModelConfig, SmoothedResult } from '../lib/types'
import type { HandLandmarker } from '@mediapipe/tasks-vision'

export type LoadStatus = 'loading' | 'ready' | 'error'
export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'error'

export interface PipelineState {
  modelStatus: LoadStatus
  modelError: string | null
  cameraStatus: CameraStatus
  cameraError: string | null
  result: SmoothedResult
  fps: number
  handPresent: boolean
  labels: string[]
  retry: () => void
}

const EMPTY_RESULT: SmoothedResult = {
  label: NO_GESTURE_LABEL,
  score: 0,
  active: false,
  top: [],
}

interface PipelineRefs {
  videoRef: React.RefObject<HTMLVideoElement | null>
  overlayRef: React.RefObject<HTMLCanvasElement | null>
}

/**
 * Orchestrates the full camera -> detect -> crop -> classify -> smooth loop.
 *
 * Three concerns are deliberately decoupled into separate effects so changing,
 * say, the camera does not reload the ONNX model:
 *   - model effect    (deps: executionProvider) owns the worker + classifier
 *   - pipeline effect (deps: facingMode, detectionConfidence) owns camera +
 *     landmarker + the requestAnimationFrame loop
 *   - live effect     mirrors fast-changing settings into refs the loop reads
 */
export function useGesturePipeline(
  { videoRef, overlayRef }: PipelineRefs,
  settings: Settings,
): PipelineState {
  const [modelStatus, setModelStatus] = useState<LoadStatus>('loading')
  const [modelError, setModelError] = useState<string | null>(null)
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [result, setResult] = useState<SmoothedResult>(EMPTY_RESULT)
  const [fps, setFps] = useState(0)
  const [handPresent, setHandPresent] = useState(false)
  const [labels, setLabels] = useState<string[]>([])
  const [retryTick, setRetryTick] = useState(0)

  // --- long-lived singletons (survive re-renders) ---
  const classifierRef = useRef<GestureClassifier | null>(null)
  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const extractorRef = useRef<RoiExtractor | null>(null)
  const modelConfigRef = useRef<ModelConfig>(DEFAULT_MODEL_CONFIG)
  const smootherRef = useRef<PredictionSmoother>(
    new PredictionSmoother({
      windowSize: settings.smoothingWindow,
      scoreThreshold: settings.scoreThreshold,
      presenceRatio: settings.presenceRatio,
      topK: TOP_K,
      labels: [],
    }),
  )

  // --- per-frame mutable state ---
  const modelReadyRef = useRef(false)
  const busyRef = useRef(false)
  const lastProbsRef = useRef<Float32Array | null>(null)
  const liveRef = useRef<Settings>(settings)
  const rafRef = useRef(0)
  const lastTsRef = useRef(0)
  const lastResultRef = useRef(0)
  const fpsRef = useRef({ frames: 0, last: 0 })

  // Keep fast-changing settings available to the rAF loop without restarting it.
  useEffect(() => {
    liveRef.current = settings
    const s = smootherRef.current
    s.windowSize = settings.smoothingWindow
    s.scoreThreshold = settings.scoreThreshold
    s.presenceRatio = settings.presenceRatio
  }, [settings])

  const loop = useCallback(() => {
    rafRef.current = requestAnimationFrame(loop)
    const video = videoRef.current
    const landmarker = landmarkerRef.current
    if (!video || !landmarker || video.readyState < 2 || !video.videoWidth) return

    let ts = performance.now()
    if (ts <= lastTsRef.current) ts = lastTsRef.current + 1
    lastTsRef.current = ts

    let detection: HandLandmarkerResult
    try {
      detection = landmarker.detectForVideo(video, ts)
    } catch {
      return
    }

    const hand = detection.landmarks[0] as NormalizedPoint[] | undefined
    const hasHand = !!hand && hand.length > 0
    const vw = video.videoWidth
    const vh = video.videoHeight
    const cfg = modelConfigRef.current

    let box: Box | null = null
    if (hasHand) {
      box = computeRoi(hand, vw, vh, cfg.roiPadding)
      // Dispatch a classification only when the worker is idle (drop frames
      // otherwise — latest-frame-wins keeps the UI responsive).
      if (modelReadyRef.current && !busyRef.current && extractorRef.current && classifierRef.current) {
        const image = extractorRef.current.extract(video, box)
        busyRef.current = true
        classifierRef.current
          .classify(image)
          .then((probs) => {
            lastProbsRef.current = probs
          })
          .catch(() => {
            /* transient inference error: drop this frame */
          })
          .finally(() => {
            busyRef.current = false
          })
      }
    }

    // Feed exactly one sample into the smoother per frame.
    const smoother = smootherRef.current
    if (hasHand) {
      if (lastProbsRef.current) smoother.push(lastProbsRef.current)
    } else {
      smoother.push(null)
      lastProbsRef.current = null
    }

    drawOverlay(overlayRef.current, vw, vh, hasHand ? hand : null, box, liveRef.current.showLandmarks)

    // FPS (sampled twice a second).
    fpsRef.current.frames++
    const elapsed = ts - fpsRef.current.last
    if (elapsed >= 500) {
      setFps(Math.round((fpsRef.current.frames * 1000) / elapsed))
      fpsRef.current = { frames: 0, last: ts }
    }

    // Result state (throttled to ~15 Hz — the canvas overlay updates every frame).
    if (ts - lastResultRef.current >= 66) {
      lastResultRef.current = ts
      setResult(smoother.result())
      setHandPresent(hasHand)
    }
  }, [videoRef, overlayRef])

  // --- model + worker effect ---
  useEffect(() => {
    let cancelled = false
    setModelStatus('loading')
    setModelError(null)
    modelReadyRef.current = false

    const classifier = new GestureClassifier()
    classifierRef.current = classifier

    void (async () => {
      const cfg = await loadModelConfig()
      const labelList = await loadLabels()
      if (cancelled) return

      modelConfigRef.current = cfg
      setLabels(labelList)
      smootherRef.current.labels = labelList
      extractorRef.current = new RoiExtractor(cfg.inputSize)

      try {
        await classifier.init(paths.model(), cfg, [settings.executionProvider])
        if (cancelled) return
        modelReadyRef.current = true
        setModelStatus('ready')
      } catch (err) {
        if (cancelled) return
        setModelStatus('error')
        setModelError(friendlyModelError(err))
      }
    })()

    return () => {
      cancelled = true
      modelReadyRef.current = false
      classifier.dispose()
      classifierRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.executionProvider, retryTick])

  // --- camera + landmarker + loop effect ---
  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    let landmarker: HandLandmarker | null = null
    setCameraStatus('requesting')
    setCameraError(null)

    void (async () => {
      try {
        // On insecure origins (e.g. LAN over plain HTTP) the browser does not
        // expose navigator.mediaDevices at all. Fail fast with a clear message
        // instead of a cryptic "reading 'getUserMedia' of undefined" TypeError,
        // and before we bother downloading the MediaPipe model.
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('CAMERA_API_UNAVAILABLE')
        }
        landmarker = await createHandLandmarker({
          numHands: 1,
          minDetectionConfidence: settings.detectionConfidence,
        })
        if (cancelled) {
          landmarker.close()
          return
        }
        landmarkerRef.current = landmarker

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: settings.facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
        if (cancelled) {
          stopStream(stream)
          return
        }

        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        if (cancelled) return

        setCameraStatus('ready')
        fpsRef.current = { frames: 0, last: performance.now() }
        rafRef.current = requestAnimationFrame(loop)
      } catch (err) {
        if (cancelled) return
        setCameraStatus('error')
        setCameraError(friendlyCameraError(err))
      }
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      if (stream) stopStream(stream)
      if (videoRef.current) videoRef.current.srcObject = null
      landmarkerRef.current = null
      try {
        landmarker?.close()
      } catch {
        /* ignore */
      }
      smootherRef.current.reset()
      lastProbsRef.current = null
      busyRef.current = false
      setHandPresent(false)
      setResult(EMPTY_RESULT)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.facingMode, settings.detectionConfidence, retryTick, loop])

  const retry = useCallback(() => setRetryTick((t) => t + 1), [])

  return {
    modelStatus,
    modelError,
    cameraStatus,
    cameraError,
    result,
    fps,
    handPresent,
    labels,
    retry,
  }
}

// ---------------------------------------------------------------------------
// Helpers (module scope — no React state)
// ---------------------------------------------------------------------------

async function loadLabels(): Promise<string[]> {
  try {
    const res = await fetch(paths.labels())
    if (!res.ok) return []
    const data: unknown = await res.json()
    const arr = Array.isArray(data)
      ? data
      : data && typeof data === 'object' && Array.isArray((data as { labels?: unknown }).labels)
        ? (data as { labels: unknown[] }).labels
        : null
    return arr ? arr.map((v) => String(v)) : []
  } catch {
    return []
  }
}

async function loadModelConfig(): Promise<ModelConfig> {
  try {
    const res = await fetch(paths.modelConfig())
    if (!res.ok) return DEFAULT_MODEL_CONFIG
    const partial = (await res.json()) as Partial<ModelConfig>
    return { ...DEFAULT_MODEL_CONFIG, ...partial }
  } catch {
    return DEFAULT_MODEL_CONFIG
  }
}

function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop()
}

function friendlyCameraError(err: unknown): string {
  // Insecure origin (LAN over plain HTTP) is the most common blocker: the
  // browser hides navigator.mediaDevices, so getUserMedia is unreachable.
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return '摄像头不可用：页面需运行在安全上下文（HTTPS 或 localhost）。当前多为局域网 HTTP，浏览器已隐藏摄像头接口。手机可用 adb reverse 端口转发后访问 localhost，或在浏览器 flags 中将该来源标记为安全。'
  }
  const apiUnavailable =
    (err instanceof Error && err.message === 'CAMERA_API_UNAVAILABLE') ||
    (err instanceof TypeError && /mediaDevices|getUserMedia/.test(err.message))
  if (apiUnavailable) {
    return '当前浏览器不支持摄像头采集（navigator.mediaDevices 不可用）。请使用较新的浏览器，并在 HTTPS 或 localhost 下访问。'
  }

  const name = err instanceof DOMException ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return '摄像头权限被拒绝。请在浏览器站点设置中允许摄像头访问后重试。'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return '未找到可用摄像头，或所选摄像头不支持。'
    case 'NotReadableError':
      return '摄像头被其他应用占用，请关闭后重试。'
    default:
      return `无法访问摄像头：${err instanceof Error ? err.message : String(err)}`
  }
}

function friendlyModelError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/404|failed to fetch|not found|no available backend|protobuf|invalid|cannot|load/i.test(msg)) {
    return '未能加载手势模型。请确认 public/models/gesture.onnx 存在且为有效 ONNX 文件，然后重试。'
  }
  return `模型加载失败：${msg}`
}

function drawOverlay(
  canvas: HTMLCanvasElement | null,
  vw: number,
  vh: number,
  landmarks: NormalizedPoint[] | null,
  box: Box | null,
  showLandmarks: boolean,
): void {
  if (!canvas) return
  if (canvas.width !== vw) canvas.width = vw
  if (canvas.height !== vh) canvas.height = vh
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, vw, vh)

  if (box) {
    const radius = Math.min(box.w, box.h) * 0.08
    ctx.lineWidth = Math.max(2, vw * 0.004)
    ctx.strokeStyle = landmarks ? 'rgba(94,212,255,0.95)' : 'rgba(255,255,255,0.45)'
    ctx.beginPath()
    ctx.roundRect(box.x, box.y, box.w, box.h, radius)
    ctx.stroke()
  }

  if (showLandmarks && landmarks) {
    ctx.lineWidth = Math.max(1.5, vw * 0.0025)
    ctx.strokeStyle = 'rgba(94,212,255,0.65)'
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.beginPath()
      ctx.moveTo(landmarks[a].x * vw, landmarks[a].y * vh)
      ctx.lineTo(landmarks[b].x * vw, landmarks[b].y * vh)
      ctx.stroke()
    }
    ctx.fillStyle = '#ffffff'
    const r = Math.max(2.5, vw * 0.004)
    for (const p of landmarks) {
      ctx.beginPath()
      ctx.arc(p.x * vw, p.y * vh, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
