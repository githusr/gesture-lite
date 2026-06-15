// Parametric hand-pose specs for the gesture guide icons. Each gesture is
// described by which fingers are extended plus orientation, so a single
// renderer (see components/HandPose.tsx) draws a consistent, accurate icon set
// — far more maintainable (and correct) than 18 hand-drawn SVGs.
//
// These map to the committed HaGRID labels. A label with no entry falls back to
// its emoji (from gestures.meta.json) or a neutral glyph, so the guide stays
// model-agnostic.

export interface HandPoseSpec {
  thumb?: boolean
  index?: boolean
  middle?: boolean
  ring?: boolean
  pinky?: boolean
  /** Fan the extended fingers apart (e.g. a peace "V" vs. two fingers together). */
  spread?: boolean
  /** Back of the hand toward the camera (the "_inverted" gestures); shown with knuckle dots. */
  back?: boolean
}

export const GESTURE_POSES: Record<string, HandPoseSpec> = {
  fist: {},
  one: { index: true },
  two_up: { index: true, middle: true },
  two_up_inverted: { index: true, middle: true, back: true },
  three: { index: true, middle: true, ring: true },
  three2: { thumb: true, index: true, middle: true },
  four: { index: true, middle: true, ring: true, pinky: true, spread: true },
  peace: { index: true, middle: true, spread: true },
  peace_inverted: { index: true, middle: true, spread: true, back: true },
  palm: { thumb: true, index: true, middle: true, ring: true, pinky: true, spread: true },
  stop: { thumb: true, index: true, middle: true, ring: true, pinky: true },
  stop_inverted: { thumb: true, index: true, middle: true, ring: true, pinky: true, back: true },
  rock: { index: true, pinky: true },
  call: { thumb: true, pinky: true },
}
