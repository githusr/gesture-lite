import { cn } from '../lib/cn'
import { formatPercent, prettyLabel } from '../lib/format'
import { useI18n } from '../lib/i18n'
import type { PipelineState } from '../hooks/useGesturePipeline'
import { StatusOverlay } from './StatusOverlay'

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>
  overlayRef: React.RefObject<HTMLCanvasElement | null>
  mirror: boolean
  state: PipelineState
}

/**
 * The camera stage: the live <video>, the landmark/box overlay <canvas> drawn
 * on top of it, status overlays, and lightweight on-feed badges (FPS, privacy,
 * live label). Both video and canvas share `object-cover` + optional mirroring
 * so the overlay (drawn in raw video coordinates) stays perfectly aligned.
 */
export function CameraView({ videoRef, overlayRef, mirror, state }: Props) {
  const { t } = useI18n()
  const { result, fps, modelStatus, modelError, cameraStatus, cameraError, retry } = state

  return (
    <div className="relative aspect-3/4 w-full overflow-hidden rounded-3xl bg-black ring-1 ring-white/10 sm:aspect-video lg:aspect-auto lg:h-full">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn('absolute inset-0 h-full w-full object-cover', mirror && 'mirror')}
      />
      <canvas
        ref={overlayRef}
        className={cn(
          'pointer-events-none absolute inset-0 h-full w-full object-cover',
          mirror && 'mirror',
        )}
      />

      {/* top badges */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <span className="rounded-full bg-ink-950/70 px-2.5 py-1 font-mono text-xs text-white/80 backdrop-blur">
          {fps} FPS
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-ink-950/70 px-2.5 py-1 text-xs text-white/70 backdrop-blur">
          <svg className="h-3.5 w-3.5 text-good" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          </svg>
          {t.privacy}
        </span>
      </div>

      {/* model loading / error banner (camera still works without the model) */}
      {modelStatus !== 'ready' && cameraStatus === 'ready' && (
        <div className="pointer-events-none absolute inset-x-0 top-12 flex justify-center px-3">
          <div
            className={cn(
              'max-w-sm rounded-xl px-3 py-1.5 text-center text-xs backdrop-blur',
              modelStatus === 'error'
                ? 'bg-bad/20 text-bad'
                : 'bg-ink-950/70 text-white/70',
            )}
          >
            {modelStatus === 'error' && modelError ? t.modelError[modelError] : t.modelLoading}
          </div>
        </div>
      )}

      {/* live label chip */}
      {cameraStatus === 'ready' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/90 to-transparent p-4 pt-10">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-white/40">
                {t.currentGesture}
              </p>
              <p
                className={cn(
                  'truncate text-2xl font-semibold sm:text-3xl',
                  result.active ? 'text-white' : 'text-white/45',
                )}
              >
                {prettyLabel(result.label, t.noGesture)}
              </p>
            </div>
            {result.active && (
              <span className="shrink-0 rounded-lg bg-accent/15 px-2.5 py-1 font-mono text-sm text-accent">
                {formatPercent(result.score, 0)}
              </span>
            )}
          </div>
        </div>
      )}

      <StatusOverlay
        cameraStatus={cameraStatus}
        cameraError={cameraError}
        modelStatus={modelStatus}
        onRetry={retry}
      />
    </div>
  )
}
