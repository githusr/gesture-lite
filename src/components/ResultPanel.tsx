import { cn } from '../lib/cn'
import { formatPercent, prettyLabel } from '../lib/format'
import type { Prediction } from '../lib/types'
import type { PipelineState } from '../hooks/useGesturePipeline'

interface Props {
  state: PipelineState
}

function StatusDot({ status }: { status: 'ready' | 'loading' | 'error' }) {
  const color =
    status === 'ready' ? 'bg-good' : status === 'loading' ? 'bg-warn animate-pulse-ring' : 'bg-bad'
  return <span className={cn('inline-block h-2 w-2 rounded-full', color)} />
}

function PredictionRow({ pred, rank }: { pred: Prediction; rank: number }) {
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-xs text-white/35">{rank}</span>
          <span className={cn('truncate', rank === 1 ? 'font-semibold text-white' : 'text-white/70')}>
            {prettyLabel(pred.label)}
          </span>
        </span>
        <span className="shrink-0 font-mono text-xs text-white/60">{formatPercent(pred.score)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
        <div
          className={cn('h-full rounded-full transition-[width] duration-150', rank === 1 ? 'bg-accent' : 'bg-accent/40')}
          style={{ width: `${Math.max(2, Math.min(100, pred.score * 100))}%` }}
        />
      </div>
    </li>
  )
}

/** Detailed read-out: status chips, the committed gesture, and Top-K bars. */
export function ResultPanel({ state }: Props) {
  const { result, modelStatus, cameraStatus, labels, handPresent } = state
  const top = result.top.slice(0, 3)

  return (
    <section className="rounded-2xl bg-ink-850/80 p-4 ring-1 ring-white/5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white/80">识别结果</h2>
        <div className="flex items-center gap-3 text-xs text-white/45">
          <span className="flex items-center gap-1.5">
            <StatusDot status={modelStatus} />
            模型
          </span>
          <span className="flex items-center gap-1.5">
            <StatusDot status={cameraStatus === 'ready' ? 'ready' : cameraStatus === 'error' ? 'error' : 'loading'} />
            摄像头
          </span>
        </div>
      </div>

      <div className="mb-4 rounded-xl bg-ink-900/60 p-3">
        <p className="text-xs text-white/40">{handPresent ? '已检测到手部' : '未检测到手部'}</p>
        <p className={cn('mt-0.5 text-xl font-semibold', result.active ? 'text-accent' : 'text-white/45')}>
          {prettyLabel(result.label)}
        </p>
      </div>

      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/35">Top 3</p>
      {top.length > 0 ? (
        <ol className="space-y-2.5">
          {top.map((pred, i) => (
            <PredictionRow key={pred.index} pred={pred} rank={i + 1} />
          ))}
        </ol>
      ) : (
        <p className="py-3 text-center text-sm text-white/35">
          {modelStatus === 'ready' ? '将手放入画面以开始识别' : '等待模型与摄像头就绪…'}
        </p>
      )}

      <p className="mt-4 text-right text-xs text-white/30">
        {labels.length > 0 ? `${labels.length} 个类别` : '未加载类别表'}
      </p>
    </section>
  )
}
