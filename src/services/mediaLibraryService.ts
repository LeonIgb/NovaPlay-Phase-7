import { VideoItem } from '../types';
import { tintFor } from '../utils/library';
import { FileSystemMod, MediaLibraryMod } from './native';

export type AccessState = 'unknown' | 'granted' | 'denied' | 'blocked' | 'unsupported';
export type AccessResult = { state: AccessState; detail?: string };

const PAGE_SIZE = 100;
const MAX_VIDEOS = 3000; // safety cap for very large libraries

const stripExt = (name: string) => name.replace(/\.[^.]+$/, '');

function mapPermission(res: any): AccessState {
  if (res?.granted) return 'granted';
  if (res?.status === 'undetermined') return 'unknown';
  return res?.canAskAgain === false ? 'blocked' : 'denied';
}

/** Checks the current permission without showing a prompt. */
export async function getAccess(): Promise<AccessResult> {
  const ML = MediaLibraryMod.mod;
  if (!ML) return { state: 'unsupported', detail: MediaLibraryMod.error ?? 'expo-media-library did not load' };
  try {
    return { state: mapPermission(await ML.getPermissionsAsync(false, ['video'])) };
  } catch (e: any) {
    return { state: 'unsupported', detail: e?.message ?? String(e) };
  }
}

/** Shows the system permission prompt (video access only). */
export async function requestAccess(): Promise<AccessResult> {
  const ML = MediaLibraryMod.mod;
  if (!ML) return { state: 'unsupported', detail: MediaLibraryMod.error ?? 'expo-media-library did not load' };
  try {
    return { state: mapPermission(await ML.requestPermissionsAsync(false, ['video'])) };
  } catch (e: any) {
    return { state: 'unsupported', detail: e?.message ?? String(e) };
  }
}

function toItem(a: any, albumNames: Map<string, string>): VideoItem {
  const albumId = a.albumId != null ? String(a.albumId) : undefined;
  const filename: string = a.filename || `video-${a.id}`;
  return {
    id: `device:${a.id}`,
    title: stripExt(filename),
    filename,
    uri: a.uri,
    source: 'device',
    folder: albumId ? albumNames.get(albumId) ?? 'Other folder' : 'Device',
    folderKey: `album:${albumId ?? 'none'}`,
    tint: tintFor(String(a.id)),
    durationSec: typeof a.duration === 'number' && a.duration > 0 ? a.duration : undefined,
    createdAt: a.creationTime || a.modificationTime || undefined,
    width: a.width > 0 ? a.width : undefined,
    height: a.height > 0 ? a.height : undefined,
  };
}

/** Lists every video the media store exposes to this app (not arbitrary folders). */
export async function scanDeviceVideos(): Promise<VideoItem[]> {
  const ML = MediaLibraryMod.mod;
  if (!ML) throw new Error(MediaLibraryMod.error ?? 'expo-media-library did not load');

  const albumNames = new Map<string, string>();
  try {
    const albums = await ML.getAlbumsAsync();
    for (const al of albums ?? []) albumNames.set(String(al.id), al.title);
  } catch {
    // Albums are optional: videos then appear under "Other folder" / "Device".
  }

  const out: VideoItem[] = [];
  let after: string | undefined;
  while (out.length < MAX_VIDEOS) {
    const res = await ML.getAssetsAsync({
      first: PAGE_SIZE,
      after,
      mediaType: ML.MediaType.video,
      sortBy: [[ML.SortBy.creationTime, false]],
    });
    for (const a of res.assets ?? []) out.push(toItem(a, albumNames));
    if (!res.hasNextPage || !res.endCursor) break;
    after = res.endCursor;
  }
  return out;
}

/** Reads file sizes in small chunks after the scan so the UI never stalls. Sizes that can't be read stay unknown. */
export async function fillSizes(
  items: VideoItem[],
  onChunk: (sizes: Map<string, number>) => void,
  cancelled: () => boolean,
): Promise<void> {
  const FS = FileSystemMod.mod;
  if (!FS) return;
  const CHUNK = 40;
  for (let i = 0; i < items.length; i += CHUNK) {
    if (cancelled()) return;
    const sizes = new Map<string, number>();
    for (const v of items.slice(i, i + CHUNK)) {
      if (v.sizeMb || !v.uri.startsWith('file://')) continue;
      try {
        const bytes = new FS.File(v.uri).size;
        if (bytes > 0) sizes.set(v.id, bytes / (1024 * 1024));
      } catch {
        // unreadable: leave the size unknown
      }
    }
    if (sizes.size) onChunk(sizes);
    await new Promise<void>((r) => setTimeout(() => r(), 0));
  }
}
