/**
 * Optional native modules are loaded defensively. If one fails to load (for example a Snack
 * packaging problem), the matching feature reports "unavailable" instead of crashing the app.
 */
type Loaded = { mod: any; error: string | null };

function load(get: () => any): Loaded {
  try {
    return { mod: get(), error: null };
  } catch (e: any) {
    return { mod: null, error: e?.message ?? String(e) };
  }
}

export const MediaLibraryMod = load(() => require('expo-media-library'));
export const ThumbnailsMod = load(() => require('expo-video-thumbnails'));
export const FileSystemMod = load(() => require('expo-file-system'));
export const StorageMod = load(() => {
  const m = require('@react-native-async-storage/async-storage');
  return m.default ?? m;
});
export const KeepAwakeMod = load(() => require('expo-keep-awake'));
