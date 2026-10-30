import { VideoItem } from '../types';
import { DEFAULT_SORT, SORT_KEYS, SortState, tintFor } from './library';

export type Source = 'device' | 'imported';

/** Enough of a video to show it (dimmed) even when the file itself is gone. */
export type Snapshot = {
  id: string;
  title: string;
  filename: string;
  source: Source;
  uri: string;
  folder: string;
  folderKey: string;
  durationSec?: number;
  sizeMb?: number;
  createdAt?: number;
};
export type FavoriteEntry = Snapshot & { addedAt: number };
export type HistoryEntry = Snapshot & { playedAt: number };
export type PositionEntry = { id: string; positionSec: number; durationSec?: number; filename: string; source: Source; updatedAt: number };
export type ResumeMode = 'ask' | 'always' | 'never';
export const RESUME_MODES: ResumeMode[] = ['ask', 'always', 'never'];
export const SEEK_STEP_OPTIONS = [5, 10, 15, 30] as const;

/** Every field here changes real behaviour in the player. */
export type Settings = {
  rememberSpeed: boolean; // speed chosen in the player becomes the new default
  doubleTapSeek: boolean; // double-tap left/right seeks, double-tap middle plays/pauses
  swipeSeek: boolean; // horizontal swipe on the video scrubs
  seekStepSec: number; // seconds for double-tap and the skip buttons
  autoAdvance: boolean; // play the next video in the queue when one ends
  resumeMode: ResumeMode; // ask / always resume / never resume
  autoHideControls: boolean; // hide controls after a few seconds while playing
  keepScreenOn: boolean; // stop the screen sleeping while a video plays
};

export const DEFAULT_SETTINGS: Settings = {
  rememberSpeed: true,
  doubleTapSeek: true,
  swipeSeek: true,
  seekStepSec: 10,
  autoAdvance: true,
  resumeMode: 'ask',
  autoHideControls: true,
  keepScreenOn: true,
};

/** Invalid or missing fields fall back to `base` (the defaults when loading, the current values when updating). */
export function sanitizeSettings(raw: any, base: Settings = DEFAULT_SETTINGS): Settings {
  const r = raw && typeof raw === 'object' ? raw : {};
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  return {
    rememberSpeed: bool(r.rememberSpeed, base.rememberSpeed),
    doubleTapSeek: bool(r.doubleTapSeek, base.doubleTapSeek),
    swipeSeek: bool(r.swipeSeek, base.swipeSeek),
    seekStepSec: (SEEK_STEP_OPTIONS as readonly number[]).includes(r.seekStepSec) ? r.seekStepSec : base.seekStepSec,
    autoAdvance: bool(r.autoAdvance, base.autoAdvance),
    resumeMode: RESUME_MODES.includes(r.resumeMode) ? r.resumeMode : base.resumeMode,
    autoHideControls: bool(r.autoHideControls, base.autoHideControls),
    keepScreenOn: bool(r.keepScreenOn, base.keepScreenOn),
  };
}

export type Prefs = { playbackRate: number; sort: SortState; lastPlayedId?: string; settings: Settings };
export type UserData = {
  version: 1;
  favorites: FavoriteEntry[]; // newest first, unique ids
  history: HistoryEntry[]; // most recent first, unique ids
  positions: Record<string, PositionEntry>;
  prefs: Prefs;
};

export const MAX_HISTORY = 100;
export const MAX_FAVORITES = 1000;
export const MAX_POSITIONS = 300;

export const emptyUserData = (): UserData => ({
  version: 1,
  favorites: [],
  history: [],
  positions: {},
  prefs: { playbackRate: 1, sort: { ...DEFAULT_SORT }, settings: { ...DEFAULT_SETTINGS } },
});

const num = (n: unknown): number | undefined => (typeof n === 'number' && isFinite(n) && n > 0 ? n : undefined);
const sourceOf = (id: string, s: unknown): Source | null =>
  s === 'device' || s === 'imported' ? s : id.startsWith('device:') ? 'device' : id.startsWith('imp:') ? 'imported' : null;

function sanitizeSnapshot(r: any): Snapshot | null {
  if (!r || typeof r.id !== 'string' || !r.id || typeof r.title !== 'string' || typeof r.uri !== 'string') return null;
  const source = sourceOf(r.id, r.source);
  if (!source) return null;
  return {
    id: r.id,
    title: r.title,
    filename: typeof r.filename === 'string' && r.filename ? r.filename : r.title,
    source,
    uri: r.uri,
    folder: typeof r.folder === 'string' ? r.folder : source === 'imported' ? 'Imported' : 'Device',
    folderKey: typeof r.folderKey === 'string' ? r.folderKey : source === 'imported' ? 'imported' : 'album:none',
    durationSec: num(r.durationSec),
    sizeMb: num(r.sizeMb),
    createdAt: num(r.createdAt),
  };
}

/** Rebuilds a trustworthy UserData from whatever was stored: drops bad entries, removes duplicates, enforces caps. */
export function sanitizeUserData(raw: unknown): UserData {
  const out = emptyUserData();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as any;

  const favs = new Map<string, FavoriteEntry>();
  for (const e of Array.isArray(r.favorites) ? r.favorites : []) {
    const s = sanitizeSnapshot(e);
    if (!s) continue;
    const addedAt = num(e.addedAt) ?? 0;
    const prev = favs.get(s.id);
    if (!prev || addedAt > prev.addedAt) favs.set(s.id, { ...s, addedAt });
  }
  out.favorites = [...favs.values()].sort((a, b) => b.addedAt - a.addedAt).slice(0, MAX_FAVORITES);

  const hist = new Map<string, HistoryEntry>();
  for (const e of Array.isArray(r.history) ? r.history : []) {
    const s = sanitizeSnapshot(e);
    if (!s) continue;
    const playedAt = num(e.playedAt) ?? 0;
    const prev = hist.get(s.id);
    if (!prev || playedAt > prev.playedAt) hist.set(s.id, { ...s, playedAt });
  }
  out.history = [...hist.values()].sort((a, b) => b.playedAt - a.playedAt).slice(0, MAX_HISTORY);

  const pos: PositionEntry[] = [];
  const rawPos = r.positions && typeof r.positions === 'object' && !Array.isArray(r.positions) ? r.positions : {};
  for (const [key, e] of Object.entries<any>(rawPos)) {
    const id = typeof e?.id === 'string' && e.id ? e.id : key;
    const positionSec = num(e?.positionSec);
    const source = sourceOf(id, e?.source);
    if (!positionSec || !source) continue;
    pos.push({ id, positionSec, durationSec: num(e.durationSec), filename: typeof e.filename === 'string' ? e.filename : '', source, updatedAt: num(e.updatedAt) ?? 0 });
  }
  pos.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_POSITIONS).forEach((p) => { if (!out.positions[p.id]) out.positions[p.id] = p; });

  const p = r.prefs ?? {};
  const rate = typeof p.playbackRate === 'number' && p.playbackRate >= 0.25 && p.playbackRate <= 4 ? Math.round(p.playbackRate * 100) / 100 : 1;
  const sort: SortState =
    p.sort && SORT_KEYS.includes(p.sort.key) && (p.sort.dir === 'asc' || p.sort.dir === 'desc') ? { key: p.sort.key, dir: p.sort.dir } : { ...DEFAULT_SORT };
  out.prefs = { playbackRate: rate, sort, lastPlayedId: typeof p.lastPlayedId === 'string' ? p.lastPlayedId : undefined, settings: sanitizeSettings(p.settings) };
  return out;
}

export const snapshotOf = (v: VideoItem): Snapshot => ({
  id: v.id, title: v.title, filename: v.filename, source: v.source, uri: v.uri,
  folder: v.folder, folderKey: v.folderKey, durationSec: v.durationSec, sizeMb: v.sizeMb, createdAt: v.createdAt,
});

export function placeholderFromSnapshot(s: Snapshot): VideoItem {
  return {
    id: s.id, title: s.title, filename: s.filename, uri: s.uri, source: s.source, folder: s.folder, folderKey: s.folderKey,
    tint: tintFor(s.id), durationSec: s.durationSec, sizeMb: s.sizeMb, createdAt: s.createdAt, missing: true,
  };
}

/** Entries in stored order; entries whose video is no longer in the library appear as unavailable placeholders. */
export function resolveEntries(entries: Snapshot[], videos: VideoItem[]): VideoItem[] {
  const byId = new Map(videos.map((v) => [v.id, v]));
  return entries.map((e) => byId.get(e.id) ?? placeholderFromSnapshot(e));
}

// ---------- favorites / history ----------

export function toggleFavorite(ud: UserData, v: VideoItem, now: number): { data: UserData; isFavorite: boolean } {
  if (ud.favorites.some((f) => f.id === v.id)) return { data: removeFavorite(ud, v.id), isFavorite: false };
  return { data: { ...ud, favorites: [{ ...snapshotOf(v), addedAt: now }, ...ud.favorites].slice(0, MAX_FAVORITES) }, isFavorite: true };
}

export const removeFavorite = (ud: UserData, id: string): UserData =>
  ud.favorites.some((f) => f.id === id) ? { ...ud, favorites: ud.favorites.filter((f) => f.id !== id) } : ud;

/** One entry per video: replaying moves it to the top instead of adding a duplicate. */
export function recordPlay(ud: UserData, v: VideoItem, now: number): UserData {
  const history = [{ ...snapshotOf(v), playedAt: now }, ...ud.history.filter((h) => h.id !== v.id)].slice(0, MAX_HISTORY);
  return { ...ud, history, prefs: { ...ud.prefs, lastPlayedId: v.id } };
}

export const removeHistory = (ud: UserData, id: string): UserData =>
  ud.history.some((h) => h.id === id) ? { ...ud, history: ud.history.filter((h) => h.id !== id) } : ud;

export const clearHistory = (ud: UserData): UserData => (ud.history.length ? { ...ud, history: [] } : ud);

// ---------- resume positions ----------

/** Positions before `min` aren't worth resuming; within `tail` of the end counts as finished. Both shrink for short videos. */
export function resumeBounds(durationSec?: number) {
  return durationSec && durationSec > 0
    ? { min: Math.min(5, durationSec * 0.2), tail: Math.min(10, durationSec * 0.1) }
    : { min: 5, tail: 10 };
}

export function clearPosition(ud: UserData, id: string): UserData {
  if (!(id in ud.positions)) return ud;
  const positions = { ...ud.positions };
  delete positions[id];
  return { ...ud, positions };
}

/** Returns the same object when nothing needs to change, so callers can skip saving. */
export function savePosition(ud: UserData, v: Pick<VideoItem, 'id' | 'filename' | 'source'>, positionSec: number, durationSec: number, now: number): UserData {
  if (!isFinite(positionSec) || positionSec < 0) return ud;
  const d = isFinite(durationSec) && durationSec > 0 ? durationSec : undefined;
  const { min, tail } = resumeBounds(d);
  if (d !== undefined && positionSec >= d - tail) return clearPosition(ud, v.id); // finished
  if (positionSec < min) return ud;
  const prev = ud.positions[v.id];
  if (prev && Math.abs(prev.positionSec - positionSec) < 1 && prev.durationSec === d) return ud;
  const positions = { ...ud.positions, [v.id]: { id: v.id, positionSec, durationSec: d ?? prev?.durationSec, filename: v.filename, source: v.source, updatedAt: now } };
  const ids = Object.keys(positions);
  if (ids.length > MAX_POSITIONS) {
    ids.sort((a, b) => positions[a].updatedAt - positions[b].updatedAt);
    ids.slice(0, ids.length - MAX_POSITIONS).forEach((id) => delete positions[id]);
  }
  return { ...ud, positions };
}

export function getResumePosition(ud: UserData, id: string, durationHint?: number): number | null {
  const e = ud.positions[id];
  if (!e) return null;
  const d = durationHint ?? e.durationSec;
  const { min, tail } = resumeBounds(d);
  if (!(e.positionSec >= min)) return null;
  if (d && e.positionSec >= d - tail) return null;
  return e.positionSec;
}

// ---------- moved / deleted files ----------

const sameFile = (c: VideoItem, durationSec?: number, sizeMb?: number): boolean =>
  !!((durationSec && c.durationSec && Math.abs(c.durationSec - durationSec) <= 1) || (sizeMb && c.sizeMb && Math.abs(c.sizeMb - sizeMb) < 0.05));

/**
 * Keeps saved data pointing at real videos:
 * - imported entries whose file is gone from the library are dropped (nothing can bring them back)
 * - device entries whose id vanished are re-linked to a video with the same file name and duration/size (a moved file)
 * - anything else stays and shows up as "unavailable"
 * - stored snapshots are refreshed from the live library entry
 */
export function reconcileIds(
  ud: UserData,
  videos: VideoItem[],
  ctx: { deviceScanned: boolean; importedReady: boolean },
): { data: UserData; changed: boolean } {
  const byId = new Map(videos.map((v) => [v.id, v]));
  const byName = new Map<string, VideoItem[]>();
  for (const v of videos) {
    const k = v.filename.toLowerCase();
    const list = byName.get(k);
    if (list) list.push(v); else byName.set(k, [v]);
  }
  const referenced = new Set<string>([...ud.favorites.map((f) => f.id), ...ud.history.map((h) => h.id), ...Object.keys(ud.positions)]);
  const renames = new Map<string, string | null>(); // old id -> new id, or null = drop

  const decide = (id: string, source: Source, filename: string, durationSec?: number, sizeMb?: number) => {
    if (byId.has(id) || renames.has(id)) return;
    if (source === 'imported') { if (ctx.importedReady) renames.set(id, null); return; }
    if (!ctx.deviceScanned) return;
    const match = (byName.get(filename.toLowerCase()) ?? []).find((c) => c.source === 'device' && !referenced.has(c.id) && sameFile(c, durationSec, sizeMb));
    if (match) { renames.set(id, match.id); referenced.add(match.id); }
  };
  ud.favorites.forEach((f) => decide(f.id, f.source, f.filename, f.durationSec, f.sizeMb));
  ud.history.forEach((h) => decide(h.id, h.source, h.filename, h.durationSec, h.sizeMb));
  Object.values(ud.positions).forEach((p) => decide(p.id, p.source, p.filename, p.durationSec));

  let changed = renames.size > 0;
  const mapId = (id: string): string | null => (renames.has(id) ? (renames.get(id) as string | null) : id);

  const refresh = <T extends Snapshot>(e: T): T => {
    const v = byId.get(e.id);
    if (!v) return e;
    const next = { ...e, title: v.title, filename: v.filename, uri: v.uri, folder: v.folder, folderKey: v.folderKey, durationSec: v.durationSec ?? e.durationSec, sizeMb: v.sizeMb ?? e.sizeMb, createdAt: v.createdAt ?? e.createdAt };
    const differs = next.title !== e.title || next.filename !== e.filename || next.uri !== e.uri || next.folder !== e.folder || next.folderKey !== e.folderKey || next.durationSec !== e.durationSec || next.sizeMb !== e.sizeMb || next.createdAt !== e.createdAt;
    if (differs) { changed = true; return next; }
    return e;
  };
  const remap = <T extends Snapshot>(list: T[]): T[] => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const e of list) {
      const nid = mapId(e.id);
      if (nid === null || seen.has(nid)) continue;
      seen.add(nid);
      out.push(refresh(nid === e.id ? e : { ...e, id: nid }));
    }
    if (out.length !== list.length) changed = true;
    return out;
  };

  const favorites = remap(ud.favorites);
  const history = remap(ud.history);
  const positions: Record<string, PositionEntry> = {};
  for (const p of Object.values(ud.positions)) {
    const nid = mapId(p.id);
    if (nid === null) { changed = true; continue; }
    const prev = positions[nid];
    if (!prev || p.updatedAt > prev.updatedAt) positions[nid] = nid === p.id ? p : { ...p, id: nid };
  }
  if (Object.keys(positions).length !== Object.keys(ud.positions).length) changed = true;

  if (!changed) return { data: ud, changed: false };
  const last = ud.prefs.lastPlayedId;
  const lastMapped = last ? mapId(last) : null;
  return { data: { ...ud, favorites, history, positions, prefs: { ...ud.prefs, lastPlayedId: lastMapped ?? undefined } }, changed: true };
}

// ---------- settings ----------

export function updateSettings(ud: UserData, patch: Partial<Settings>): UserData {
  const next = sanitizeSettings({ ...ud.prefs.settings, ...patch }, ud.prefs.settings);
  const same = (Object.keys(next) as Array<keyof Settings>).every((k) => next[k] === ud.prefs.settings[k]);
  return same ? ud : { ...ud, prefs: { ...ud.prefs, settings: next } };
}

/** Restores every setting and the default speed. Favorites, history, positions and sort order are untouched. */
export function resetSettings(ud: UserData): UserData {
  return { ...ud, prefs: { ...ud.prefs, playbackRate: 1, settings: { ...DEFAULT_SETTINGS } } };
}

export const clearAllPositions = (ud: UserData): UserData => (Object.keys(ud.positions).length ? { ...ud, positions: {} } : ud);
