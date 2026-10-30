import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme/colors';
import { ScreenProps, VideoItem } from '../types';
import { useLibrary } from '../state/LibraryContext';
import { useUserData } from '../state/UserDataContext';
import { SPEEDS, usePlayback } from '../hooks/usePlayback';
import { useFullscreen } from '../hooks/useFullscreen';
import { useKeepAwake } from '../hooks/useKeepAwake';
import { videoEngine } from '../engine/videoEngine';
import { isFileMissing } from '../services/importedStore';
import { formatTime, metaLine } from '../utils/format';
import { sameTrack, trackLabel } from '../utils/subtitles';
import { buildRows, findPlayable, plural, resolveQueue } from '../utils/queue';
import { resumePlan } from '../utils/resume';
import PlayerSurface from '../components/PlayerSurface';
import OptionSheet from '../components/OptionSheet';
import QueueList from '../components/QueueList';
import ResumePrompt from '../components/ResumePrompt';
import StateView from '../components/StateView';
import Toast from '../components/Toast';

type Props = ScreenProps<'Player'>;
type Intent = { kind: 'direct' | 'auto'; dir: 1 | -1 };

const VideoView = videoEngine.VideoView;

export default function PlayerScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const { videos: allVideos, setDuration } = useLibrary();
  const queueIds = route.params.queue;
  // Queue rules: the order of the list the user opened the video from, no shuffling, no wrap-around.
  const videos = useMemo(() => resolveQueue(allVideos, queueIds), [allVideos, queueIds]);
  const ud = useUserData();
  const st = ud.settings;
  const { fullscreen, exit: exitFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const [currentId, setCurrentId] = useState(route.params.videoId);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const [handledId, setHandledId] = useState<string | null>(null); // video whose Resume/Restart choice is settled
  const failedRef = useRef(failed);
  failedRef.current = failed;
  // 'auto' = reached via Next/Previous/auto-advance (an unplayable video is skipped); 'direct' = the user tapped it (show the error).
  const intent = useRef<Intent>({ kind: 'direct', dir: 1 });

  const index = videos.findIndex((v) => v.id === currentId);
  const video = index >= 0 ? videos[index] : undefined;

  const notify = useCallback((text: string) => setNotice({ id: Date.now(), text }), []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  // Cheap check (flags only) for rendering; strict check (also touches the file system) only when navigating.
  const quickUnavailable = useCallback((v: VideoItem) => !!v.missing || failed.has(v.id), [failed]);
  const hardMissing = useCallback((v: VideoItem) => !!v.missing || (v.source === 'imported' && isFileMissing(v.uri)), []);
  const strictUnavailable = useCallback((v: VideoItem) => failed.has(v.id) || hardMissing(v), [failed, hardMissing]);

  const hasPrev = useMemo(() => findPlayable(videos, index, -1, quickUnavailable).found, [videos, index, quickUnavailable]);
  const hasNext = useMemo(() => findPlayable(videos, index, 1, quickUnavailable).found, [videos, index, quickUnavailable]);

  const goTo = useCallback((id: string, kind: Intent['kind'], dir: 1 | -1) => {
    intent.current = { kind, dir };
    setCurrentId(id);
  }, []);

  const step = useCallback((dir: 1 | -1, kind: Intent['kind']) => {
    const r = findPlayable(videos, index, dir, strictUnavailable);
    if (!r.found) {
      notify(dir === 1 ? "You've reached the end of the queue." : 'This is the first video in the queue.');
      return;
    }
    if (r.skipped.length) {
      notify(`Skipped ${plural(r.skipped.length, 'unavailable video')}.`);
      setFailed((prev) => { const n = new Set(prev); r.skipped.forEach((v) => n.add(v.id)); return n; });
    }
    goTo(videos[r.index].id, kind, dir);
  }, [videos, index, strictUnavailable, notify, goTo]);

  // Resume: opened directly -> ask (playback waits); reached via Next/auto-advance -> resume without interrupting.
  const savedPos = video ? ud.getResumePosition(video.id, video.durationSec) : null;
  const plan = resumePlan(st.resumeMode, savedPos, handledId === currentId, intent.current.kind);
  const wantsPrompt = plan === 'prompt';
  const wantsAutoResume = plan === 'auto';

  const pb = usePlayback(video?.uri ?? null, {
    onEnd: () => {
      if (video) ud.clearPosition(video.id); // finished: next time starts from the beginning
      if (st.autoAdvance) step(1, 'auto');
    },
    onDuration: (sec) => { if (video) setDuration(video.id, sec); },
    autoPlay: !wantsPrompt,
    initialRate: ud.prefs.playbackRate,
  });
  const showPrompt = wantsPrompt && pb.status === 'ready' && savedPos != null;
  useKeepAwake(pb.isPlaying && st.keepScreenOn);

  // Playback errors: remember the video as unavailable; if we got here automatically, move on in the same direction.
  useEffect(() => {
    if (!video || !videoEngine.available) return; // a missing engine would fail every video, so don't blame the files
    if (pb.status === 'ready') {
      if (failedRef.current.has(video.id)) setFailed((prev) => { const n = new Set(prev); n.delete(video.id); return n; });
      return;
    }
    if (pb.status !== 'error' || failedRef.current.has(video.id)) return;
    const nextFailed = new Set(failedRef.current).add(video.id);
    setFailed(nextFailed);
    if (intent.current.kind !== 'auto') return;
    const dir = intent.current.dir;
    const r = findPlayable(videos, index, dir, (v) => nextFailed.has(v.id) || hardMissing(v));
    if (r.found) {
      notify(`Skipped “${video.title}” because it can't be played.`);
      goTo(videos[r.index].id, 'auto', dir);
    } else {
      notify('No more playable videos in the queue.');
    }
  }, [pb.status, video, videos, index, notify, goTo, hardMissing]);

  // Auto-resume (Next / auto-advance): jump to the saved spot once the video is ready.
  useEffect(() => {
    if (!wantsAutoResume || pb.status !== 'ready' || savedPos == null) return;
    setHandledId(currentId);
    if (pb.duration > 0 && savedPos >= pb.duration) { ud.clearPosition(currentId); return; } // file changed since: ignore
    pb.seekTo(savedPos);
    notify(`Resumed from ${formatTime(savedPos)}`);
  }, [wantsAutoResume, pb.status, pb.duration, savedPos, currentId, pb.seekTo, ud.clearPosition, notify]);

  // A saved position beyond the real length means the file was replaced: forget it instead of offering a bad resume.
  useEffect(() => {
    if (!video || pb.status !== 'ready' || savedPos == null || pb.duration <= 0) return;
    if (savedPos >= pb.duration) { ud.clearPosition(video.id); setHandledId(video.id); }
  }, [video, pb.status, pb.duration, savedPos, ud.clearPosition]);

  // History: one entry per video, recorded when playback actually starts.
  const recordedId = useRef<string | null>(null);
  useEffect(() => {
    if (!video || !pb.isPlaying || recordedId.current === video.id) return;
    recordedId.current = video.id;
    ud.recordPlay(video);
  }, [video, pb.isPlaying, ud.recordPlay]);

  // Position: saved every 5 s while playing, and once more on pause, video change, leaving and backgrounding.
  const latest = useRef({ video, position: pb.position, duration: pb.duration, status: pb.status });
  latest.current = { video, position: pb.position, duration: pb.duration, status: pb.status };
  useEffect(() => {
    if (!pb.isPlaying) return;
    const v = latest.current.video;
    if (!v) return;
    const save = () => {
      const l = latest.current;
      if (l.status === 'ready') ud.savePosition(v, l.position, l.duration);
    };
    const t = setInterval(save, 5000);
    return () => { clearInterval(t); save(); };
  }, [pb.isPlaying, video?.id, ud.savePosition]);

  useEffect(() => { setSpeedOpen(false); setSubsOpen(false); }, [currentId]);
  useEffect(() => { if (!fullscreen) setLocked(false); }, [fullscreen]);

  // Hardware/gesture back: close a menu first, ignore while locked, leave fullscreen before leaving the screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (locked) return true;
      if (speedOpen || subsOpen) { setSpeedOpen(false); setSubsOpen(false); return true; }
      if (fullscreen) { exitFullscreen(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [locked, speedOpen, subsOpen, fullscreen, exitFullscreen]);

  const onSelect = useCallback((v: VideoItem) => {
    if (hardMissing(v)) { notify(`“${v.title}” is missing or can't be opened.`); return; }
    const to = videos.findIndex((x) => x.id === v.id);
    goTo(v.id, 'direct', to >= index ? 1 : -1);
  }, [hardMissing, videos, index, notify, goTo]);

  const resume = () => {
    if (savedPos == null) return;
    setHandledId(currentId);
    pb.seekTo(savedPos);
    pb.play();
  };
  const restart = () => {
    setHandledId(currentId);
    ud.clearPosition(currentId);
    pb.seekTo(0);
    pb.play();
  };
  const settle = () => { if (wantsPrompt) setHandledId(currentId); }; // any manual seek counts as an answer
  const onTogglePlay = () => { if (showPrompt) restart(); else pb.togglePlay(); };

  const isFav = ud.favoriteIds.has(currentId);
  const toggleFav = useCallback(() => {
    if (!video) return;
    notify(ud.toggleFavorite(video) ? 'Added to favorites' : 'Removed from favorites');
  }, [video, ud.toggleFavorite, notify]);

  const rows = useMemo(() => buildRows(videos, index, failed), [videos, index, failed]);
  const hasSubs = pb.subtitleTracks.length > 0;

  // Rebuilt only when what it shows changes, not on every playback tick.
  const header = useMemo(() => (
    <View>
      <View style={styles.info}>
        <Text style={styles.title}>{video?.title}</Text>
        <Text style={styles.meta}>{video ? metaLine(video) : ''}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={() => setSpeedOpen(true)} style={styles.actionPill} accessibilityRole="button" accessibilityLabel="Playback speed">
          <Ionicons name="speedometer-outline" size={18} color={colors.primary} />
          <Text style={styles.actionText}>Speed{pb.rate !== 1 ? ` ${pb.rate}×` : ''}</Text>
        </Pressable>
        {hasSubs && (
          <Pressable onPress={() => setSubsOpen(true)} style={styles.actionPill} accessibilityRole="button" accessibilityLabel="Subtitles">
            <Ionicons name="chatbox-ellipses-outline" size={18} color={colors.primary} />
            <Text style={styles.actionText}>Subtitles</Text>
          </Pressable>
        )}
        <Pressable onPress={toggleFav} style={styles.actionPill} accessibilityRole="button" accessibilityState={{ selected: isFav }} accessibilityLabel={isFav ? 'Remove from favorites' : 'Add to favorites'}>
          <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={18} color={colors.primary} />
          <Text style={styles.actionText}>{isFav ? 'Favorited' : 'Favorite'}</Text>
        </Pressable>
        <Pressable
          onPress={() => Alert.alert('Not connected yet', 'Details arrives in a later phase.')}
          style={styles.actionPill}
          accessibilityRole="button"
          accessibilityLabel="Details (not connected)"
        >
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>Details</Text>
        </Pressable>
      </View>
      <Text style={styles.queuePos}>Queue · {index + 1} of {videos.length}</Text>
    </View>
  ), [video, pb.rate, hasSubs, index, videos.length, isFav, toggleFav]);

  if (!video) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StateView kind="error" title="Video not found" message="This video is no longer in your library." actionLabel="Back to library" onAction={() => navigation.goBack()} />
      </View>
    );
  }

  const goPrev = () => {
    if (pb.position > 3 || !hasPrev) pb.seekTo(0); // standard behaviour: restart first, then go back
    else step(-1, 'auto');
  };
  const retry = () => {
    intent.current = { kind: 'direct', dir: 1 };
    setFailed((prev) => { const n = new Set(prev); n.delete(video.id); return n; });
    pb.retry();
  };

  const speedOptions = SPEEDS.map((r) => ({ key: String(r), label: r === 1 ? 'Normal (1×)' : `${r}×`, selected: r === pb.rate }));
  const subOptions = [
    { key: 'off', label: 'Off', selected: !pb.subtitleTrack },
    ...pb.subtitleTracks.map((t, i) => ({ key: String(i), label: trackLabel(t, i), selected: sameTrack(t, pb.subtitleTrack) })),
  ];

  const split = landscape && !fullscreen;
  // One stable tree: the video surface is always the first child, so switching between
  // portrait / landscape / fullscreen only changes styles and never remounts the player view.
  const rootStyle = fullscreen
    ? { paddingLeft: insets.left, paddingRight: insets.right }
    : split
      ? { flexDirection: 'row' as const, paddingLeft: insets.left, paddingRight: insets.right }
      : { paddingTop: insets.top };
  const surfaceWrap = fullscreen ? styles.fill : split ? styles.splitVideo : styles.portraitVideo;

  return (
    <View style={[styles.root, rootStyle]}>
      <StatusBar hidden={fullscreen} style="light" />

      <View style={surfaceWrap}>
        <PlayerSurface
          style={styles.fill}
          videoLayer={<VideoView player={pb.player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />}
          title={video.title}
          durationSec={pb.duration}
          positionSec={pb.position}
          bufferedSec={pb.buffered}
          isPlaying={pb.isPlaying}
          status={pb.status}
          error={pb.error}
          rateLabel={pb.rate !== 1 ? `${pb.rate}×` : null}
          fullscreen={fullscreen}
          canPrev={hasPrev}
          canNext={hasNext}
          hasSubtitles={hasSubs}
          subtitlesOn={!!pb.subtitleTrack}
          locked={locked}
          menuOpen={speedOpen || subsOpen}
          onBack={() => (fullscreen ? exitFullscreen() : navigation.goBack())}
          onTogglePlay={onTogglePlay}
          onSeekBy={(d) => { settle(); pb.seekBy(d); }}
          onSeekTo={(t) => { settle(); pb.seekTo(t); }}
          onSeekRatio={(r) => { settle(); pb.seekTo(r * pb.duration); }}
          onPrev={goPrev}
          onNext={() => step(1, 'auto')}
          onToggleFullscreen={toggleFullscreen}
          onSettings={() => setSpeedOpen(true)}
          onSubtitles={() => setSubsOpen(true)}
          onLock={() => setLocked(true)}
          onUnlock={() => setLocked(false)}
          onRetry={retry}
          onSkipNext={hasNext ? () => step(1, 'auto') : undefined}
          seekStepSec={st.seekStepSec}
          doubleTapSeek={st.doubleTapSeek}
          swipeSeek={st.swipeSeek}
          autoHide={st.autoHideControls}
        />
        {showPrompt && savedPos != null ? <ResumePrompt positionSec={savedPos} onResume={resume} onRestart={restart} /> : null}
      </View>

      {!fullscreen ? (
        <View style={split ? { flex: 2, paddingTop: insets.top } : styles.fill}>
          <QueueList rows={rows} header={header} bottomInset={insets.bottom} onSelect={onSelect} />
        </View>
      ) : null}

      {speedOpen ? (
        <OptionSheet title="Playback speed" options={speedOptions} onSelect={(k) => { const r = Number(k); pb.setRate(r); if (st.rememberSpeed) ud.setPrefs({ playbackRate: r }); }} onClose={() => setSpeedOpen(false)} />
      ) : null}
      {subsOpen ? (
        <OptionSheet
          title="Subtitles"
          options={subOptions}
          onSelect={(k) => pb.setSubtitleTrack(k === 'off' ? null : pb.subtitleTracks[Number(k)])}
          onClose={() => setSubsOpen(false)}
        />
      ) : null}
      {notice ? <Toast key={notice.id} text={notice.text} bottom={fullscreen ? 76 : insets.bottom + spacing.lg} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  portraitVideo: { width: '100%', aspectRatio: 16 / 9 },
  splitVideo: { flex: 3 },
  info: { padding: spacing.lg, gap: 4 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', lineHeight: 24 },
  meta: { color: colors.textSecondary, fontSize: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  actionPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  actionText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  queuePos: { color: colors.textSecondary, fontSize: 12, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
});
