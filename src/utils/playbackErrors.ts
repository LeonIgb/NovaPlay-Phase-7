export type PlaybackError = { message: string; detail: string };

export function friendlyPlaybackError(raw?: string): PlaybackError {
  const m = (raw ?? '').toLowerCase();
  let message = "This video can't be played.";
  if (/decoder|codec|unsupported|format|mime/.test(m)) {
    message = "This video's format or codec isn't supported on this device.";
  } else if (/not found|enoent|no such file|permission|open failed|eacces/.test(m)) {
    message = "The file couldn't be opened. It may have been moved, deleted, or access was lost.";
  } else if (/malformed|corrupt|parsing|invalid/.test(m)) {
    message = 'The file appears to be damaged or incomplete.';
  }
  return { message, detail: raw ?? '' };
}
