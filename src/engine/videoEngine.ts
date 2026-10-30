import type React from 'react';
/**
 * Loads expo-video defensively. If the module fails to evaluate (for example a Snack/SDK
 * packaging problem), the app still starts and the player shows the real error message
 * instead of crashing the whole app at startup.
 */
let mod: any = null;
let loadError: string | null = null;
try {
  mod = require('expo-video');
} catch (e: any) {
  loadError = e?.message ?? String(e);
}

const noop = () => { /* engine unavailable */ };
const fallbackPlayer = {
  status: 'error',
  playing: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  timeUpdateEventInterval: 0,
  availableSubtitleTracks: [] as any[],
  subtitleTrack: null as any,
  addListener: () => ({ remove: noop }),
  play: noop,
  pause: noop,
  replace: noop,
};

const available = !!(mod && mod.useVideoPlayer && mod.VideoView);

export const videoEngine = {
  available,
  error: available ? null : loadError ?? 'expo-video did not export useVideoPlayer/VideoView',
  useVideoPlayer: (available ? mod.useVideoPlayer : () => fallbackPlayer) as (source: string | null, setup?: (p: any) => void) => any,
  VideoView: (available ? mod.VideoView : () => null) as React.ComponentType<any>,
};
