import type { HandPoseSpec } from '../lib/gesturePoses'

// Finger anchor positions on a 24×24 grid (hand pointing up). Extended fingers
// are drawn as rounded strokes from the palm to their tip; folded fingers are
// simply omitted. The `down` flag rotates the whole hand 180° for the
// "_inverted" gestures.
const FINGER = {
  index: { x: 9.3, tipY: 4.8 },
  middle: { x: 12, tipY: 3.5 },
  ring: { x: 14.7, tipY: 4.8 },
  pinky: { x: 16.6, tipY: 7 },
} as const
type FingerName = keyof typeof FINGER
const FINGER_NAMES = Object.keys(FINGER) as FingerName[]
const BASE_Y = 13.4

interface Props {
  spec: HandPoseSpec
  className?: string
}

export function HandPose({ spec, className }: Props) {
  const extended = FINGER_NAMES.filter((f) => spec[f])
  const centroid =
    extended.length > 0
      ? extended.reduce((sum, f) => sum + FINGER[f].x, 0) / extended.length
      : 12

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="6.8" y="12" width="10.4" height="8.4" rx="3.4" />
      {extended.map((f) => {
        const baseX = FINGER[f].x
        const tipX = spec.spread ? baseX + (baseX - centroid) * 0.8 : baseX
        return <line key={f} x1={baseX} y1={BASE_Y} x2={tipX} y2={FINGER[f].tipY} />
      })}
      {spec.thumb && <line x1="7" y1="14.2" x2="3.9" y2="10.2" />}
      {/* knuckle dots denote the back of the hand (the "_inverted" gestures). */}
      {spec.back &&
        extended.map((f) => (
          <circle key={`k-${f}`} cx={FINGER[f].x} cy={15.6} r={0.7} fill="currentColor" stroke="none" />
        ))}
    </svg>
  )
}
