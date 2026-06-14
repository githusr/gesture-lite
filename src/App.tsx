import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CameraView } from './components/CameraView'
import { ResultPanel } from './components/ResultPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { DEFAULT_SETTINGS, type Settings } from './lib/config'
import { useGesturePipeline } from './hooks/useGesturePipeline'

const SETTINGS_KEY = 'gesture-lite:settings'

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    /* ignore malformed storage */
  }
  return DEFAULT_SETTINGS
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)

  const [settings, setSettings] = useState<Settings>(loadSettings)
  const webgpuAvailable = useMemo(() => typeof navigator !== 'undefined' && 'gpu' in navigator, [])

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* storage may be unavailable (private mode) */
    }
  }, [settings])

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => setSettings((prev) => ({ ...prev, ...patch })),
    [],
  )

  const state = useGesturePipeline({ videoRef, overlayRef }, settings)

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-3 py-4 sm:px-5 sm:py-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
            Gesture<span className="text-accent">Lite</span>
          </h1>
          <p className="text-xs text-white/40">浏览器端本地静态手势识别</p>
        </div>
        <a
          href="https://github.com/google-ai-edge/mediapipe"
          target="_blank"
          rel="noreferrer"
          className="hidden text-xs text-white/30 transition hover:text-white/60 sm:block"
        >
          MediaPipe · onnxruntime-web
        </a>
      </header>

      <main className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-stretch">
        <div className="flex min-h-0 flex-1 flex-col">
          <CameraView
            videoRef={videoRef}
            overlayRef={overlayRef}
            mirror={settings.mirror}
            state={state}
          />
        </div>

        <aside className="flex w-full flex-col gap-4 lg:w-[360px] lg:shrink-0">
          <ResultPanel state={state} />
          <SettingsPanel
            settings={settings}
            onChange={updateSettings}
            webgpuAvailable={webgpuAvailable}
          />
        </aside>
      </main>

      <footer className="mt-4 text-center text-xs text-white/25">
        所有画面与推理均在本地完成，不会上传任何图像。
      </footer>
    </div>
  )
}
