import { VideoItem } from '../types';

export type FindResult = { found: boolean; index: number; skipped: VideoItem[] };

/** Next playable entry in a direction (no wrap-around). Reports which unavailable entries were passed over. */
export function findPlayable(queue: VideoItem[], from: number, dir: 1 | -1, isUnavailable: (v: VideoItem) => boolean): FindResult {
  const skipped: VideoItem[] = [];
  for (let i = from + dir; i >= 0 && i < queue.length; i += dir) {
    if (!isUnavailable(queue[i])) return { found: true, index: i, skipped };
    skipped.push(queue[i]);
  }
  return { found: false, index: -1, skipped };
}

/** Turns the ids handed over by the library into an ordered, de-duplicated list of videos that still exist. */
export function resolveQueue(all: VideoItem[], ids?: string[]): VideoItem[] {
  if (!ids) return all;
  const byId = new Map(all.map((v) => [v.id, v]));
  const seen = new Set<string>();
  const out: VideoItem[] = [];
  for (const id of ids) {
    const v = byId.get(id);
    if (v && !seen.has(id)) { seen.add(id); out.push(v); }
  }
  return out;
}

export type QueueRow =
  | { type: 'header'; key: string; title: string; hint?: string }
  | { type: 'video'; key: string; video: VideoItem }
  | { type: 'end'; key: string; text: string };

/** "Up next" = entries after the current one (the order Next follows); "Earlier in queue" = entries before it. */
export function buildRows(queue: VideoItem[], index: number, failed: ReadonlySet<string>): QueueRow[] {
  const mark = (v: VideoItem): VideoItem => (failed.has(v.id) && !v.missing ? { ...v, missing: true } : v);
  const after = index >= 0 ? queue.slice(index + 1) : queue;
  const before = index > 0 ? queue.slice(0, index) : [];
  const rows: QueueRow[] = [{ type: 'header', key: 'h-next', title: 'Up next', hint: after.length ? `${after.length} in queue` : undefined }];
  if (after.length === 0) rows.push({ type: 'end', key: 'end', text: "You're at the end of the queue." });
  else after.forEach((v) => rows.push({ type: 'video', key: `n-${v.id}`, video: mark(v) }));
  if (before.length) {
    rows.push({ type: 'header', key: 'h-prev', title: 'Earlier in queue', hint: `${before.length}` });
    before.forEach((v) => rows.push({ type: 'video', key: `p-${v.id}`, video: mark(v) }));
  }
  return rows;
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
