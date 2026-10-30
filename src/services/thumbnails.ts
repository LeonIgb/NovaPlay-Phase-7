import { ThumbnailsMod } from './native';

const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();
const interest = new Map<string, number>(); // how many mounted rows currently want this thumbnail
const MAX_PARALLEL = 2;
let active = 0;

type Job = { id: string; run: () => void; cancel: () => void };
const waiting: Job[] = [];

// Newest request runs first (LIFO): rows the user just scrolled to load before rows scrolled past.
function schedule<T>(id: string, job: () => Promise<T>, cancelledValue: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const run = () => {
      active += 1;
      job().then(resolve).finally(() => {
        active -= 1;
        const next = waiting.pop();
        if (next) next.run();
      });
    };
    if (active < MAX_PARALLEL) run();
    else waiting.push({ id, run, cancel: () => resolve(cancelledValue) });
  });
}

export function getCachedThumbnail(id: string): string | null | undefined {
  return cache.get(id);
}

/** Generates (once per session) a frame image for a video. Resolves null when it can't be generated or was cancelled. */
export function requestThumbnail(id: string, uri: string, durationSec?: number): Promise<string | null> {
  interest.set(id, (interest.get(id) ?? 0) + 1);
  if (cache.has(id)) return Promise.resolve(cache.get(id) ?? null);
  const inflight = pending.get(id);
  if (inflight) return inflight;
  const mod = ThumbnailsMod.mod;
  if (!mod) {
    cache.set(id, null);
    return Promise.resolve(null);
  }
  const p = schedule<string | null>(
    id,
    async () => {
      try {
        const time = durationSec && durationSec > 0 ? Math.min(1000, durationSec * 500) : 1000;
        const res = await mod.getThumbnailAsync(uri, { time, quality: 0.5 });
        cache.set(id, res.uri);
        return res.uri as string;
      } catch {
        cache.set(id, null);
        return null;
      } finally {
        pending.delete(id);
      }
    },
    null,
  );
  pending.set(id, p);
  return p;
}

/** Call when a row stops needing its thumbnail. A job that hasn't started yet is dropped (nothing is cached). */
export function releaseThumbnail(id: string): void {
  const n = (interest.get(id) ?? 1) - 1;
  if (n > 0) { interest.set(id, n); return; }
  interest.delete(id);
  const i = waiting.findIndex((j) => j.id === id);
  if (i >= 0) {
    const [job] = waiting.splice(i, 1);
    pending.delete(id);
    job.cancel();
  }
}
