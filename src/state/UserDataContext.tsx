import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { VideoItem } from '../types';
import { useLibrary } from './LibraryContext';
import { loadUserData, saveUserData } from '../services/userDataStore';
import * as ops from '../utils/userData';
import { FavoriteEntry, HistoryEntry, Prefs, Settings, UserData } from '../utils/userData';

const SAVE_DELAY_MS = 1500;

type Ctx = {
  hydrated: boolean;
  warning: string | null;
  favorites: FavoriteEntry[];
  favoriteIds: ReadonlySet<string>;
  history: HistoryEntry[];
  prefs: Prefs;
  settings: Settings;
  positionCount: number;
  toggleFavorite: (v: VideoItem) => boolean; // returns the new favorite state
  removeFavorite: (id: string) => void;
  recordPlay: (v: VideoItem) => void;
  removeHistory: (id: string) => void;
  clearHistory: () => void;
  savePosition: (v: VideoItem, positionSec: number, durationSec: number) => void;
  clearPosition: (id: string) => void;
  getResumePosition: (id: string, durationHint?: number) => number | null;
  setPrefs: (patch: Partial<Prefs>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
  clearAllPositions: () => void;
};

const UserDataContext = createContext<Ctx | null>(null);

/**
 * The saved data lives in a ref (single source of truth). Favorites/history/prefs changes re-render the UI;
 * resume positions are saved every few seconds and must NOT re-render anything, so they only touch the ref.
 * Everything is written to storage together, shortly after the last change and whenever the app leaves the foreground.
 */
export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const lib = useLibrary();
  const dataRef = useRef<UserData>(ops.emptyUserData());
  const [version, setVersion] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  const dirty = useRef(false);
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!dirty.current || !hydratedRef.current || saving.current) return;
    dirty.current = false;
    saving.current = true;
    const err = await saveUserData(dataRef.current);
    saving.current = false;
    if (err) { dirty.current = true; setWarning(err); } else setWarning(null);
    if (dirty.current && !err) flush(); // changed while saving
  }, []);

  const commit = useCallback((next: UserData, rerender = true) => {
    if (!hydratedRef.current || next === dataRef.current) return;
    dataRef.current = next;
    dirty.current = true;
    if (rerender) setVersion((v) => v + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }, [flush]);

  useEffect(() => {
    let alive = true;
    loadUserData().then((res) => {
      if (!alive) return;
      dataRef.current = res.data;
      hydratedRef.current = true;
      setWarning(res.warning);
      setHydrated(true);
      setVersion((v) => v + 1);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') flush(); });
    return () => { sub.remove(); flush(); };
  }, [flush]);

  // Keep saved entries pointing at real videos (moved files re-linked, removed imports dropped).
  const videoCount = lib.videos.length;
  useEffect(() => {
    if (!hydrated || !lib.hydrated) return;
    const res = ops.reconcileIds(dataRef.current, lib.videos, { deviceScanned: lib.deviceScanned, importedReady: lib.hydrated });
    if (res.changed) commit(res.data);
    // lib.videos is intentionally read through videoCount/deviceScanned so size/duration updates don't re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, lib.hydrated, lib.deviceScanned, videoCount, commit]);

  const toggleFavorite = useCallback((v: VideoItem) => {
    const res = ops.toggleFavorite(dataRef.current, v, Date.now());
    commit(res.data);
    return res.isFavorite;
  }, [commit]);
  const removeFavorite = useCallback((id: string) => commit(ops.removeFavorite(dataRef.current, id)), [commit]);
  const recordPlay = useCallback((v: VideoItem) => commit(ops.recordPlay(dataRef.current, v, Date.now())), [commit]);
  const removeHistory = useCallback((id: string) => commit(ops.removeHistory(dataRef.current, id)), [commit]);
  const clearHistory = useCallback(() => commit(ops.clearHistory(dataRef.current)), [commit]);
  const savePosition = useCallback(
    (v: VideoItem, positionSec: number, durationSec: number) => commit(ops.savePosition(dataRef.current, v, positionSec, durationSec, Date.now()), false),
    [commit],
  );
  const clearPosition = useCallback((id: string) => commit(ops.clearPosition(dataRef.current, id), false), [commit]);
  const getResumePosition = useCallback((id: string, durationHint?: number) => ops.getResumePosition(dataRef.current, id, durationHint), []);
  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    const cur = dataRef.current;
    commit({ ...cur, prefs: { ...cur.prefs, ...patch } });
  }, [commit]);

  const updateSettings = useCallback((patch: Partial<Settings>) => commit(ops.updateSettings(dataRef.current, patch)), [commit]);
  const resetSettings = useCallback(() => commit(ops.resetSettings(dataRef.current)), [commit]);
  const clearAllPositions = useCallback(() => commit(ops.clearAllPositions(dataRef.current)), [commit]);

  const data = dataRef.current;
  const favoriteIds = useMemo(() => new Set(data.favorites.map((f) => f.id)), [data.favorites]);
  const value = useMemo<Ctx>(
    () => ({
      hydrated, warning, favorites: data.favorites, favoriteIds, history: data.history, prefs: data.prefs, settings: data.prefs.settings,
      positionCount: Object.keys(data.positions).length,
      updateSettings, resetSettings, clearAllPositions,
      toggleFavorite, removeFavorite, recordPlay, removeHistory, clearHistory, savePosition, clearPosition, getResumePosition, setPrefs,
    }),
    // `version` signals that dataRef.current changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, hydrated, warning, favoriteIds, toggleFavorite, removeFavorite, recordPlay, removeHistory, clearHistory, savePosition, clearPosition, getResumePosition, setPrefs, updateSettings, resetSettings, clearAllPositions],
  );
  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserData(): Ctx {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error('useUserData must be used inside UserDataProvider');
  return ctx;
}
