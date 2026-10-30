import { VideoItem } from '../types';

export type SortKey = 'date' | 'name' | 'duration' | 'size';
export type SortState = { key: SortKey; dir: 'asc' | 'desc' };

export const SORT_KEYS: SortKey[] = ['date', 'name', 'duration', 'size'];
export const SORT_LABEL: Record<SortKey, string> = { date: 'Date', name: 'Name', duration: 'Duration', size: 'Size' };
export const NATURAL_DIR: Record<SortKey, 'asc' | 'desc'> = { date: 'desc', name: 'asc', duration: 'desc', size: 'desc' };
export const DEFAULT_SORT: SortState = { key: 'date', dir: 'desc' };

const TINTS = ['#12313A', '#16332F', '#1E2B3F', '#2A2540', '#27333A', '#143440'];
export function tintFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export function toggleSort(current: SortState, key: SortKey): SortState {
  return current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: NATURAL_DIR[key] };
}

export function sortLabel(s: SortState): string {
  return `${SORT_LABEL[s.key]} ${s.dir === 'asc' ? '↑' : '↓'}`;
}

function metric(v: VideoItem, key: SortKey): number | string | undefined {
  switch (key) {
    case 'name': return v.title.toLowerCase();
    case 'duration': return v.durationSec;
    case 'size': return v.sizeMb;
    default: return v.createdAt;
  }
}

/** Sorts by the chosen key. Videos missing that metadata always go last. */
export function sortVideos(list: VideoItem[], sort: SortState): VideoItem[] {
  const mul = sort.dir === 'asc' ? 1 : -1;
  const byTitle = (a: VideoItem, b: VideoItem) => (a.title.toLowerCase() < b.title.toLowerCase() ? -1 : a.title.toLowerCase() > b.title.toLowerCase() ? 1 : 0);
  return [...list].sort((a, b) => {
    const x = metric(a, sort.key);
    const y = metric(b, sort.key);
    if (x === undefined && y === undefined) return byTitle(a, b);
    if (x === undefined) return 1;
    if (y === undefined) return -1;
    const c = typeof x === 'string' ? (x < (y as string) ? -1 : x > (y as string) ? 1 : 0) : (x as number) - (y as number);
    return c !== 0 ? c * mul : byTitle(a, b);
  });
}

export function filterVideos(list: VideoItem[], query: string, folderKey: string): VideoItem[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((v) => {
    if (folderKey !== 'all' && v.folderKey !== folderKey) return false;
    if (tokens.length === 0) return true;
    const hay = `${v.title} ${v.filename} ${v.folder}`.toLowerCase();
    return tokens.every((t) => hay.includes(t));
  });
}

export type FolderOption = { key: string; label: string; count: number };

export function folderOptions(list: VideoItem[]): FolderOption[] {
  const map = new Map<string, FolderOption>();
  for (const v of list) {
    const f = map.get(v.folderKey);
    if (f) f.count += 1;
    else map.set(v.folderKey, { key: v.folderKey, label: v.folder, count: 1 });
  }
  const rest = [...map.values()].sort((a, b) => {
    if (a.key === 'imported') return -1;
    if (b.key === 'imported') return 1;
    return a.label.toLowerCase() < b.label.toLowerCase() ? -1 : 1;
  });
  return [{ key: 'all', label: 'All videos', count: list.length }, ...rest];
}

/** Validates data read back from storage so a corrupt entry can never crash the app. */
export function sanitizeImported(raw: unknown): VideoItem[] {
  if (!Array.isArray(raw)) return [];
  const out: VideoItem[] = [];
  for (const r of raw as any[]) {
    if (!r || typeof r.id !== 'string' || typeof r.uri !== 'string' || typeof r.title !== 'string') continue;
    const num = (n: any) => (typeof n === 'number' && isFinite(n) && n > 0 ? n : undefined);
    out.push({
      id: r.id,
      title: r.title,
      filename: typeof r.filename === 'string' ? r.filename : r.title,
      uri: r.uri,
      source: 'imported',
      folder: 'Imported',
      folderKey: 'imported',
      tint: tintFor(r.id),
      sizeMb: num(r.sizeMb),
      durationSec: num(r.durationSec),
      createdAt: num(r.createdAt),
      width: num(r.width),
      height: num(r.height),
    });
  }
  return out;
}
