import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { VideoItem } from '../types';
import { tintFor } from '../utils/library';
import { AccessState, fillSizes, getAccess, requestAccess, scanDeviceVideos } from '../services/mediaLibraryService';
import { deleteStoredFile, isFileMissing, loadImported, persistPickedFile, saveImported } from '../services/importedStore';

export type ImportSummary = { added: number; skipped: number; failed: number; cancelled: boolean };

type Ctx = {
  videos: VideoItem[]; // device videos + imported videos
  hydrated: boolean;
  access: AccessState;
  accessDetail: string | null;
  scanning: boolean;
  deviceScanned: boolean; // true once at least one device scan has finished successfully
  scanError: string | null;
  storageWarning: string | null;
  requestAccessAndScan: () => Promise<void>;
  rescan: () => Promise<void>;
  importFromPicker: () => Promise<ImportSummary>;
  removeImported: (id: string) => void;
  setDuration: (id: string, sec: number) => void;
};

const LibraryContext = createContext<Ctx | null>(null);
const stripExt = (n: string) => n.replace(/\.[^.]+$/, '');
const safeName = (n: string) => n.replace(/[^\w.\- ]+/g, '_');

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [imported, setImported] = useState<VideoItem[]>([]);
  const [device, setDevice] = useState<VideoItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [access, setAccess] = useState<AccessState>('unknown');
  const [accessDetail, setAccessDetail] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [deviceScanned, setDeviceScanned] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const scanToken = useRef(0);
  const importedRef = useRef(imported);
  importedRef.current = imported;

  const scan = useCallback(async () => {
    const token = ++scanToken.current;
    setScanning(true);
    setScanError(null);
    try {
      const items = await scanDeviceVideos();
      if (token !== scanToken.current) return;
      setDevice(items);
      setDeviceScanned(true);
      fillSizes(
        items,
        (sizes) => setDevice((prev) => prev.map((v) => (sizes.has(v.id) ? { ...v, sizeMb: sizes.get(v.id) } : v))),
        () => token !== scanToken.current,
      );
    } catch (e: any) {
      if (token === scanToken.current) setScanError(e?.message ?? 'Scanning the device failed.');
    } finally {
      if (token === scanToken.current) setScanning(false);
    }
  }, []);

  const recheckImported = useCallback(() => {
    setImported((prev) => {
      let changed = false;
      const next = prev.map((v) => {
        const missing = isFileMissing(v.uri);
        if (!!v.missing !== missing) changed = true;
        return { ...v, missing };
      });
      return changed ? next : prev;
    });
  }, []);

  // Startup: restore the imported library, check permission (never prompts), scan if already allowed.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [saved, acc] = await Promise.all([loadImported(), getAccess()]);
      if (!alive) return;
      setImported(saved.items.map((v) => ({ ...v, missing: isFileMissing(v.uri) })));
      setStorageWarning(saved.error);
      setAccess(acc.state);
      setAccessDetail(acc.detail ?? null);
      setHydrated(true);
      if (acc.state === 'granted') scan();
    })();
    return () => { alive = false; };
  }, [scan]);

  // Save the imported library whenever it changes.
  useEffect(() => {
    if (!hydrated) return;
    saveImported(imported).then((err) => setStorageWarning(err));
  }, [imported, hydrated]);

  // Coming back to the app: pick up permission changes made in system settings and re-verify files.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      const acc = await getAccess();
      setAccess(acc.state);
      setAccessDetail(acc.detail ?? null);
      if (acc.state === 'granted') scan();
      recheckImported();
    });
    return () => sub.remove();
  }, [scan, recheckImported]);

  const requestAccessAndScan = useCallback(async () => {
    const res = await requestAccess();
    setAccess(res.state);
    setAccessDetail(res.detail ?? null);
    if (res.state === 'granted') await scan();
  }, [scan]);

  const rescan = useCallback(async () => {
    if (access === 'granted') await scan();
    else await requestAccessAndScan();
    recheckImported();
  }, [access, scan, requestAccessAndScan, recheckImported]);

  const importFromPicker = useCallback(async (): Promise<ImportSummary> => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'video/*', multiple: true, copyToCacheDirectory: true });
    if (res.canceled) return { added: 0, skipped: 0, failed: 0, cancelled: true };

    let skipped = 0;
    let failed = 0;
    const fresh: VideoItem[] = [];
    const known = [...importedRef.current];
    res.assets.forEach((a, i) => {
      try {
        const title = stripExt(a.name);
        const sizeMb = a.size ? a.size / (1024 * 1024) : undefined;
        if (known.concat(fresh).some((v) => v.title === title && sizeMb !== undefined && v.sizeMb !== undefined && Math.abs(v.sizeMb - sizeMb) < 0.01)) {
          skipped += 1;
          return;
        }
        const id = `imp:${Date.now()}-${i}`;
        const saved = persistPickedFile(a.uri, `${Date.now()}-${i}-${safeName(a.name)}`);
        fresh.push({
          id,
          title,
          filename: a.name,
          uri: saved.uri,
          source: 'imported',
          folder: 'Imported',
          folderKey: 'imported',
          tint: tintFor(id),
          sizeMb: sizeMb ?? (saved.sizeBytes ? saved.sizeBytes / (1024 * 1024) : undefined),
          createdAt: (a as any).lastModified || Date.now(),
        });
      } catch {
        failed += 1;
      }
    });
    if (fresh.length) setImported((prev) => [...prev, ...fresh]);
    return { added: fresh.length, skipped, failed, cancelled: false };
  }, []);

  const removeImported = useCallback((id: string) => {
    const v = importedRef.current.find((x) => x.id === id);
    if (v) deleteStoredFile(v.uri);
    setImported((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const setDuration = useCallback((id: string, sec: number) => {
    const apply = (list: VideoItem[]) => {
      const v = list.find((x) => x.id === id);
      if (!v || v.durationSec === sec) return list;
      return list.map((x) => (x.id === id ? { ...x, durationSec: sec } : x));
    };
    setImported(apply);
    setDevice(apply);
  }, []);

  const videos = useMemo(() => [...device, ...imported], [device, imported]);
  const value = useMemo<Ctx>(
    () => ({ videos, hydrated, access, accessDetail, scanning, deviceScanned, scanError, storageWarning, requestAccessAndScan, rescan, importFromPicker, removeImported, setDuration }),
    [videos, hydrated, access, accessDetail, scanning, deviceScanned, scanError, storageWarning, requestAccessAndScan, rescan, importFromPicker, removeImported, setDuration],
  );
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): Ctx {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider');
  return ctx;
}
