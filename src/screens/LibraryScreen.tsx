import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, APP_NAME } from '../theme/colors';
import { MIN_TOUCH, type } from '../theme/typography';
import { ScreenProps, VideoItem } from '../types';
import { useLibrary } from '../state/LibraryContext';
import { useUserData } from '../state/UserDataContext';
import { formatSize } from '../utils/format';
import { DEFAULT_SORT, SORT_KEYS, SORT_LABEL, SortKey, filterVideos, folderOptions, sortLabel, sortVideos, toggleSort } from '../utils/library';
import { resolveEntries } from '../utils/userData';
import { videoEngine } from '../engine/videoEngine';
import IconButton from '../components/IconButton';
import StateView from '../components/StateView';
import VideoCard from '../components/VideoCard';
import SearchBar from '../components/SearchBar';
import AccessBanner from '../components/AccessBanner';
import OptionSheet from '../components/OptionSheet';

type Props = ScreenProps<'Library'>;
type View_ = 'all' | 'favorites' | 'history';
const TABS: Array<{ key: View_; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { key: 'all', label: 'All', icon: 'film-outline' },
  { key: 'favorites', label: 'Favorites', icon: 'heart-outline' },
  { key: 'history', label: 'Recent', icon: 'time-outline' },
];

export default function LibraryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const columns = Math.max(1, Math.min(4, Math.floor(width / 340))); // 1 on phones in portrait, more as space allows
  const lib = useLibrary();
  const ud = useUserData();
  const { removeImported } = lib;
  const { removeFavorite, removeHistory, clearHistory, setPrefs } = ud;

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [folder, setFolder] = useState('all');
  const [view, setView] = useState<View_>('all');
  const [sheet, setSheet] = useState<null | 'sort' | 'folder'>(null);
  const [importing, setImporting] = useState(false);

  // Restore the saved sort once saved preferences have loaded.
  const sortRestored = useRef(false);
  useEffect(() => {
    if (ud.hydrated && !sortRestored.current) { sortRestored.current = true; setSort(ud.prefs.sort); }
  }, [ud.hydrated, ud.prefs.sort]);

  const favItems = useMemo(() => resolveEntries(ud.favorites, lib.videos), [ud.favorites, lib.videos]);
  const histItems = useMemo(() => resolveEntries(ud.history, lib.videos), [ud.history, lib.videos]);
  const baseList = view === 'favorites' ? favItems : view === 'history' ? histItems : lib.videos;

  const folders = useMemo(() => folderOptions(baseList), [baseList]);
  const activeFolder = folders.some((f) => f.key === folder) ? folder : 'all';
  const activeFolderLabel = folders.find((f) => f.key === activeFolder)?.label ?? 'All videos';
  const visible = useMemo(() => {
    const matched = filterVideos(baseList, query, activeFolder);
    return view === 'history' ? matched : sortVideos(matched, sort); // Recent keeps most-recent-first order
  }, [baseList, query, activeFolder, sort, view]);
  const totalMb = visible.reduce((a, v) => a + (v.sizeMb ?? 0), 0);

  const addVideos = async () => {
    try {
      setImporting(true);
      const r = await lib.importFromPicker();
      if (r.cancelled) return;
      if (r.added === 0 && r.skipped > 0) Alert.alert('Already added', 'Those videos are already in your library.');
      else if (r.failed > 0) Alert.alert('Some files were skipped', `${r.failed} file(s) could not be imported.`);
    } catch (e: any) {
      Alert.alert("Couldn't import videos", e?.message ?? 'Something went wrong while reading the selected files.');
    } finally {
      setImporting(false);
    }
  };

  const open = useCallback((v: VideoItem) => {
    if (v.missing) {
      const buttons: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [];
      if (view === 'history') buttons.push({ text: 'Remove from history', style: 'destructive', onPress: () => removeHistory(v.id) });
      if (view === 'favorites') buttons.push({ text: 'Remove from favorites', style: 'destructive', onPress: () => removeFavorite(v.id) });
      if (view === 'all' && v.source === 'imported') buttons.push({ text: 'Remove from library', style: 'destructive', onPress: () => removeImported(v.id) });
      buttons.push({ text: view === 'all' && v.source !== 'imported' ? 'OK' : 'Cancel', style: 'cancel' });
      Alert.alert('File not found', 'This video is missing or can no longer be accessed. It may have been moved or deleted.', buttons);
      return;
    }
    navigation.navigate('Player', { videoId: v.id, queue: visible.filter((x) => !x.missing).map((x) => x.id) });
  }, [visible, view, navigation, removeImported, removeFavorite, removeHistory]);

  const confirmRemove = useCallback((v: VideoItem) => {
    if (view === 'favorites') {
      Alert.alert('Remove from favorites?', `"${v.title}"`, [
        { text: 'Remove', style: 'destructive', onPress: () => removeFavorite(v.id) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else if (view === 'history') {
      Alert.alert('Remove from history?', `"${v.title}"`, [
        { text: 'Remove', style: 'destructive', onPress: () => removeHistory(v.id) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else if (v.source === 'imported') { // device videos belong to the user's media store; the app never deletes them
      Alert.alert('Remove video?', `"${v.title}" will be removed from NovaPlay and its imported copy deleted.`, [
        { text: 'Remove', style: 'destructive', onPress: () => removeImported(v.id) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [view, removeImported, removeFavorite, removeHistory]);

  const renderCard = useCallback(({ item }: { item: VideoItem }) => (
    <View style={{ flex: 1 }}>
      <VideoCard video={item} onPress={open} onLongPress={confirmRemove} />
    </View>
  ), [open, confirmRemove]);

  const clearFilters = () => { setQuery(''); setFolder('all'); };
  const filtered = query.trim().length > 0 || activeFolder !== 'all';

  let body: React.ReactNode;
  if (importing || !lib.hydrated || !ud.hydrated || (lib.scanning && lib.videos.length === 0) || (view !== 'all' && lib.scanning && !lib.deviceScanned)) {
    body = <StateView kind="loading" message={importing ? 'Importing videos…' : lib.hydrated && ud.hydrated ? 'Scanning your device…' : 'Loading your library…'} />;
  } else if (view === 'favorites' && favItems.length === 0) {
    body = <StateView kind="empty" title="No favorites yet" message="Open a video and tap Favorite to keep it here." actionLabel="Browse videos" onAction={() => setView('all')} />;
  } else if (view === 'history' && histItems.length === 0) {
    body = <StateView kind="empty" title="Nothing played yet" message="Videos you watch will show up here." actionLabel="Browse videos" onAction={() => setView('all')} />;
  } else if (view === 'all' && lib.videos.length === 0) {
    body = (
      <StateView
        kind="empty"
        title="No videos yet"
        message={lib.access === 'granted'
          ? 'No videos were found in the folders Android shares with this app. Add videos with the file picker.'
          : 'Allow access to scan this device, or add videos with the file picker.'}
        actionLabel="Add videos"
        onAction={addVideos}
      />
    );
  } else if (visible.length === 0) {
    body = <StateView kind="empty" title="No matches" message={query.trim() ? `Nothing matches “${query.trim()}”.` : 'No videos in this folder.'} actionLabel="Clear filters" onAction={clearFilters} />;
  } else {
    body = (
      <FlatList
        key={columns}
        data={visible}
        numColumns={columns}
        keyExtractor={(v) => v.id}
        keyboardShouldPersistTaps="handled"
        columnWrapperStyle={columns > 1 ? { gap: spacing.lg } : undefined}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        ListHeaderComponent={
          <View style={styles.summaryRow}>
            <Text style={styles.summary}>
              {filtered ? `${visible.length} of ${baseList.length}` : visible.length} {visible.length === 1 ? 'video' : 'videos'}
              {totalMb > 0 ? ` · ${formatSize(totalMb)}` : ''}
              {lib.scanning ? ' · scanning…' : ''}
            </Text>
            {view === 'history' ? (
              <Pressable
                onPress={() => Alert.alert('Clear history?', 'Your favorites and saved positions are kept.', [
                  { text: 'Clear', style: 'destructive', onPress: clearHistory },
                  { text: 'Cancel', style: 'cancel' },
                ])}
                accessibilityRole="button"
                accessibilityLabel="Clear history"
              >
                <Text style={styles.clear}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={renderCard}
        refreshControl={
          <RefreshControl refreshing={lib.scanning} onRefresh={() => lib.rescan()} colors={[colors.primary]} tintColor={colors.primary} progressBackgroundColor={colors.card} />
        }
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
      />
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.logoDot} />
          <Text style={styles.brandText}>{APP_NAME}</Text>
        </View>
        <IconButton name="refresh-outline" label="Rescan device" onPress={() => lib.rescan()} />
        <IconButton name="settings-outline" label="Settings" onPress={() => navigation.navigate('Settings')} />
        <IconButton name="add-circle-outline" label="Add videos" size={28} color={colors.primary} onPress={addVideos} />
      </View>

      <SearchBar value={query} onChange={setQuery} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setView(t.key)} style={[styles.chip, view === t.key && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: view === t.key }}>
            <Ionicons name={t.icon} size={16} color={view === t.key ? colors.primary : colors.textSecondary} />
            <Text style={[styles.chipText, view !== t.key && styles.chipTextDim]}>{t.label}</Text>
          </Pressable>
        ))}
        {view !== 'history' && (
          <Pressable onPress={() => setSheet('sort')} style={styles.chip} accessibilityRole="button" accessibilityLabel="Sort videos">
            <Ionicons name="swap-vertical-outline" size={16} color={colors.primary} />
            <Text style={styles.chipText}>{sortLabel(sort)}</Text>
          </Pressable>
        )}
        <Pressable onPress={() => setSheet('folder')} style={styles.chip} accessibilityRole="button" accessibilityLabel="Filter by folder">
          <Ionicons name="folder-outline" size={16} color={colors.primary} />
          <Text style={styles.chipText} numberOfLines={1}>{activeFolderLabel}</Text>
        </Pressable>
      </ScrollView>

      {!videoEngine.available && <Text style={styles.warn}>Video engine failed to load: {videoEngine.error}</Text>}
      {lib.storageWarning && <Text style={styles.warn}>Your library may not be saved: {lib.storageWarning}</Text>}
      {ud.warning && <Text style={styles.warn}>Favorites and history: {ud.warning}</Text>}

      {lib.hydrated && view === 'all' && (
        <AccessBanner
          access={lib.access}
          detail={lib.accessDetail}
          scanError={lib.scanError}
          onAllow={() => lib.requestAccessAndScan()}
          onOpenSettings={() => Linking.openSettings()}
          onRetry={() => lib.rescan()}
        />
      )}

      {body}

      {sheet === 'sort' ? (
        <OptionSheet
          title="Sort by (tap again to reverse)"
          options={SORT_KEYS.map((k: SortKey) => ({
            key: k,
            label: k === sort.key ? `${SORT_LABEL[k]} ${sort.dir === 'asc' ? '↑' : '↓'}` : SORT_LABEL[k],
            selected: k === sort.key,
          }))}
          onSelect={(k) => { const next = toggleSort(sort, k as SortKey); setSort(next); setPrefs({ sort: next }); }}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'folder' ? (
        <OptionSheet
          title="Folder"
          options={folders.map((f) => ({ key: f.key, label: `${f.label} (${f.count})`, selected: f.key === activeFolder }))}
          onSelect={setFolder}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary, borderWidth: 3, borderColor: colors.secondary },
  brandText: { ...type.title, color: colors.text },
  chipScroll: { flexGrow: 0, marginTop: spacing.sm },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, paddingHorizontal: spacing.md, minHeight: MIN_TOUCH - 8, borderRadius: radius.pill, maxWidth: 220, borderWidth: 1, borderColor: 'transparent' },
  chipOn: { borderColor: colors.primary },
  chipText: { ...type.label, color: colors.text },
  chipTextDim: { color: colors.textSecondary },
  warn: { ...type.caption, color: colors.warning, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  summary: { ...type.label, fontWeight: '400', color: colors.textSecondary },
  clear: { ...type.label, fontWeight: '700', color: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
});
