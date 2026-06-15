import { useEffect } from 'react'
import { cn } from '../lib/cn'
import { prettyLabel } from '../lib/format'
import { GESTURE_POSES } from '../lib/gesturePoses'
import { useI18n } from '../lib/i18n'
import type { GestureMeta } from '../lib/types'
import { HandPose } from './HandPose'

interface Props {
  open: boolean
  onClose: () => void
  labels: string[]
  meta: GestureMeta
  /** Currently committed gesture label, highlighted live (empty when none). */
  currentLabel: string
}

/** Neutral hand glyph shown for gestures without a dedicated emoji. */
function HandGlyph() {
  return (
    <svg
      className="h-6 w-6 text-accent/70"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 15V8a1.4 1.4 0 0 1 2.8 0v5" />
      <path d="M13.8 13V7a1.4 1.4 0 0 1 2.8 0v6" />
      <path d="M16.6 13.5v-2a1.4 1.4 0 0 1 2.8 0v5a5 5 0 0 1-5 5h-1.8a5 5 0 0 1-3.8-1.8l-2.7-3.2a1.5 1.5 0 0 1 2.2-2l1.5 1.5" />
      <path d="M8.2 13.6V9a1.4 1.4 0 0 1 2.8 0v4" />
    </svg>
  )
}

/**
 * A "cheat sheet" of every gesture the loaded model recognises — emoji/glyph,
 * name and a short how-to from gestures.meta.json. The card matching the live
 * prediction is highlighted, tying the static reference to the running model.
 */
export function GestureGuide({ open, onClose, labels, meta, currentLabel }: Props) {
  const { t, lang } = useI18n()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.guideTitle}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/80 p-3 backdrop-blur-sm sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-ink-850 ring-1 ring-white/10"
      >
        <header className="flex items-center justify-between border-b border-line p-4">
          <div>
            <h2 className="text-base font-semibold text-white">{t.guideTitle}</h2>
            <p className="text-xs text-white/40">{t.guideSubtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t.guideClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition hover:bg-white/5 hover:text-white"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {labels.length === 0 ? (
          <p className="p-8 text-center text-sm text-white/35">{t.noLabels}</p>
        ) : (
          <ol className="grid grid-cols-2 gap-2 overflow-y-auto p-4 sm:grid-cols-3">
            {labels.map((label) => {
              const info = meta[label]
              const pose = GESTURE_POSES[label]
              const active = label === currentLabel && currentLabel !== ''
              return (
                <li
                  key={label}
                  className={cn(
                    'rounded-xl p-3 ring-1 transition',
                    active ? 'bg-accent/10 ring-accent/60' : 'bg-ink-900/60 ring-white/5',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                      {info?.emoji ? (
                        <span className="text-2xl leading-none">{info.emoji}</span>
                      ) : pose ? (
                        <HandPose spec={pose} className="h-6 w-6 text-amber-300" />
                      ) : (
                        <HandGlyph />
                      )}
                    </span>
                    <span className="truncate text-sm font-medium text-white">
                      {prettyLabel(label, t.noGesture)}
                    </span>
                    {active && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-accent animate-pulse-ring" />}
                  </div>
                  {info && (
                    <p className="mt-1.5 text-xs leading-relaxed text-white/50">{info[lang]}</p>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
