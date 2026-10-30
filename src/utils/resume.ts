import { ResumeMode } from './userData';

export type ResumePlan = 'none' | 'prompt' | 'auto';

/**
 * How a saved position is used when a video opens:
 * - never: ignore it
 * - always: jump to it without asking
 * - ask: show Resume / Start over, but only for videos the user opened directly
 *   (Next / auto-advance keep playback flowing and resume automatically)
 */
export function resumePlan(mode: ResumeMode, savedPos: number | null, settled: boolean, kind: 'direct' | 'auto'): ResumePlan {
  if (mode === 'never' || savedPos == null || settled) return 'none';
  if (kind === 'auto' || mode === 'always') return 'auto';
  return 'prompt';
}
