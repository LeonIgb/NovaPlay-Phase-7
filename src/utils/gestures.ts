export type Zone = 'left' | 'center' | 'right';

export const SEEK_STEP = 10; // seconds for double-tap seek
export const EDGE_GUARD = 24; // px at each screen edge reserved for system back gestures
export const AUTO_HIDE_MS = 3000;
export const SCRUB_SPAN_SEC = 180; // a full-width swipe covers at most this much video

/** Left 40% rewinds, right 40% skips, the middle 20% toggles play/pause. */
export function tapZone(x: number, width: number): Zone {
  const r = width > 0 ? x / width : 0.5;
  return r < 0.4 ? 'left' : r > 0.6 ? 'right' : 'center';
}

export function isEdgeTouch(absoluteX: number, screenWidth: number, guard = EDGE_GUARD): boolean {
  return absoluteX < guard || absoluteX > screenWidth - guard;
}

export function scrubTarget(startSec: number, translationX: number, width: number, durationSec: number) {
  if (!(durationSec > 0) || !(width > 0)) return { target: startSec, delta: 0 };
  const span = Math.min(durationSec, SCRUB_SPAN_SEC);
  const target = Math.min(durationSec, Math.max(0, startSec + (translationX / width) * span));
  return { target, delta: target - startSec };
}
