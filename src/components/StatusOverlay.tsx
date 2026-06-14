import { useI18n } from '../lib/i18n'
import type { CameraErrorCode } from '../lib/types'
import type { CameraStatus, LoadStatus } from '../hooks/useGesturePipeline'

interface Props {
  cameraStatus: CameraStatus
  cameraError: CameraErrorCode | null
  modelStatus: LoadStatus
  onRetry: () => void
}

function Spinner() {
  return (
    <svg className="h-8 w-8 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Full-bleed overlay shown over the camera box while the camera is being
 * requested or has failed. (Model-loading issues are surfaced less intrusively
 * by the result panel, since the camera + hand tracking still work without it.)
 */
export function StatusOverlay({ cameraStatus, cameraError, modelStatus, onRetry }: Props) {
  const { t } = useI18n()
  if (cameraStatus === 'ready') return null

  const requesting = cameraStatus === 'requesting' || cameraStatus === 'idle'

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-ink-950/80 p-6 text-center backdrop-blur-sm">
      {requesting ? (
        <>
          <Spinner />
          <p className="text-sm text-white/70">{t.requestingCamera}</p>
          {modelStatus === 'loading' && <p className="text-xs text-white/40">{t.alsoLoadingModel}</p>}
        </>
      ) : (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bad/15 text-bad">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <div className="max-w-xs space-y-1">
            <p className="font-medium text-white">{t.cameraUnavailable}</p>
            <p className="text-sm text-white/60">{cameraError && t.cameraError[cameraError]}</p>
          </div>
          <button
            onClick={onRetry}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-ink-950 transition hover:brightness-110 active:scale-95"
          >
            {t.retry}
          </button>
        </>
      )}
    </div>
  )
}
