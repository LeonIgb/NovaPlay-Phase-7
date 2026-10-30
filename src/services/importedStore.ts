import { VideoItem } from '../types';
import { sanitizeImported } from '../utils/library';
import { FileSystemMod, StorageMod } from './native';

const KEY = 'novaplay:imported:v1';

export async function loadImported(): Promise<{ items: VideoItem[]; error: string | null }> {
  const S = StorageMod.mod;
  if (!S) return { items: [], error: StorageMod.error ?? 'Storage is unavailable' };
  try {
    const raw = await S.getItem(KEY);
    return { items: raw ? sanitizeImported(JSON.parse(raw)) : [], error: null };
  } catch (e: any) {
    return { items: [], error: e?.message ?? 'Could not read the saved library' };
  }
}

export async function saveImported(items: VideoItem[]): Promise<string | null> {
  const S = StorageMod.mod;
  if (!S) return StorageMod.error ?? 'Storage is unavailable';
  try {
    const clean = items.map((v) => { const copy: Partial<VideoItem> = { ...v }; delete copy.missing; return copy; });
    await S.setItem(KEY, JSON.stringify(clean));
    return null;
  } catch (e: any) {
    return e?.message ?? 'Could not save the library';
  }
}

/** True only for files inside this app's own storage that no longer exist or can't be read. */
export function isFileMissing(uri: string): boolean {
  const FS = FileSystemMod.mod;
  if (!FS || !uri.startsWith('file://')) return false;
  try {
    return !new FS.File(uri).exists;
  } catch {
    return false;
  }
}

/** Moves a picked file (already in app cache) into persistent app storage. Falls back to the cache path. */
export function persistPickedFile(cacheUri: string, uniqueName: string): { uri: string; persistent: boolean; sizeBytes?: number } {
  const FS = FileSystemMod.mod;
  if (!FS) return { uri: cacheUri, persistent: false };
  try {
    const dir = new FS.Directory(FS.Paths.document, 'videos');
    if (!dir.exists) dir.create();
    const src = new FS.File(cacheUri);
    const dest = new FS.File(dir, uniqueName);
    src.move(dest);
    const final = dest.exists ? dest : src;
    return { uri: final.uri, persistent: true, sizeBytes: final.size ?? undefined };
  } catch {
    return { uri: cacheUri, persistent: false };
  }
}

export function deleteStoredFile(uri: string): void {
  const FS = FileSystemMod.mod;
  if (!FS || !uri.startsWith('file://')) return;
  try {
    const f = new FS.File(uri);
    if (f.exists) f.delete();
  } catch {
    // already gone or not deletable
  }
}
