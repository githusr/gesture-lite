import { useState } from 'react'
import { cn } from '../lib/cn'
import { useI18n } from '../lib/i18n'
import type { Settings } from '../lib/config'

interface Props {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string; disabled?: boolean }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-lg bg-ink-900/70 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          disabled={opt.disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition',
            opt.value === value ? 'bg-accent text-ink-950' : 'text-white/55 hover:text-white',
            opt.disabled && 'cursor-not-allowed opacity-30 hover:text-white/55',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors',
        checked ? 'bg-accent' : 'bg-ink-600',
      )}
    >
      {/* flex child + explicit padding keeps the thumb inside the track
          regardless of the browser's default button padding */}
      <span
        className={cn(
          'h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (v: number) => void
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-xs text-white/60">
        {label}
        <span className="font-mono text-white/40">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-white/60">{label}</span>
      {children}
    </div>
  )
}

/** Live tuning controls. Most changes apply instantly; camera/EP changes
 * transparently re-initialise the relevant subsystem. */
export function SettingsPanel({ settings, onChange }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(true)

  return (
    <section className="rounded-2xl bg-ink-850/80 ring-1 ring-white/5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-4"
      >
        <h2 className="text-sm font-semibold text-white/80">{t.settings}</h2>
        <svg
          className={cn('h-4 w-4 text-white/40 transition-transform', open && 'rotate-180')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="space-y-4 px-4 pb-4">
          <Row label={t.camera}>
            <div className="w-40">
              <Segmented
                value={settings.facingMode}
                onChange={(v) => onChange({ facingMode: v, mirror: v === 'user' })}
                options={[
                  { value: 'user', label: t.front },
                  { value: 'environment', label: t.back },
                ]}
              />
            </div>
          </Row>

          <Row label={t.mirror}>
            <Toggle checked={settings.mirror} onChange={(v) => onChange({ mirror: v })} />
          </Row>

          <Row label={t.showLandmarks}>
            <Toggle checked={settings.showLandmarks} onChange={(v) => onChange({ showLandmarks: v })} />
          </Row>

          <div className="space-y-3 border-t border-line pt-4">
            <Slider
              label={t.detectionSensitivity}
              value={settings.detectionConfidence}
              min={0.1}
              max={0.9}
              step={0.05}
              display={settings.detectionConfidence.toFixed(2)}
              onChange={(v) => onChange({ detectionConfidence: v })}
            />
            <Slider
              label={t.smoothingWindow}
              value={settings.smoothingWindow}
              min={1}
              max={30}
              step={1}
              display={String(settings.smoothingWindow)}
              onChange={(v) => onChange({ smoothingWindow: v })}
            />
            <Slider
              label={t.scoreThreshold}
              value={settings.scoreThreshold}
              min={0}
              max={0.95}
              step={0.05}
              display={settings.scoreThreshold.toFixed(2)}
              onChange={(v) => onChange({ scoreThreshold: v })}
            />
          </div>
          <p className="text-xs leading-relaxed text-white/30">{t.settingsHint}</p>
        </div>
      )}
    </section>
  )
}
