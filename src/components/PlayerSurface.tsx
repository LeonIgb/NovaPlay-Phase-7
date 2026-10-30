import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { colors, radius, spacing } from '../theme/colors';
import { formatTime } from '../utils/format';
import { AUTO_HIDE_MS, EDGE_GUARD, Zone, isEdgeTouch, scrubTarget, tapZone } from '../utils/gestures';
import { PlaybackError } from '../utils/playbackErrors';
import { PlaybackStatus } from '../hooks/usePlayback';
import IconButton from './IconButton';
import ProgressBar from './ProgressBar';

type Props = {
  style?: StyleProp<ViewStyle>;
  videoLayer?: React.ReactNode; // the real <VideoView/> is mounted here
  title: string;
  durationSec: number;
  positionSec: number;
  bufferedSec: number;
  isPlaying: boolean;
  status: PlaybackStatus;
  error: PlaybackError | null;
  rateLabel: string | null;
  fullscreen: boolean;
  canPrev: boolean;
  canNext: boolean;
  hasSubtitles: boolean;
  subtitlesOn: boolean;
  locked: boolean;
  menuOpen: boolean; // a sheet is open: keep controls visible
  onBack: () => void;
  onTogglePlay: () => void;
  onSeekBy: (deltaSec: number) => void;
  onSeekTo: (sec: number) => void;
  onSeekRatio: (ratio: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleFullscreen: () => void;
  onSettings: () => void;
  onSubtitles: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onRetry: () => void;
  onSkipNext?: () => void; // shown on the error panel when another playable video follows
  seekStepSec: number; // double-tap and skip-button step
  doubleTapSeek: boolean;
  swipeSeek: boolean;
  autoHide: boolean;
};

type Flash = { zone: Zone; icon: 'play-back' | 'play-forward' | 'play' | 'pause'; id: number };

export default function PlayerSurface(p: Props) {
  const { width: screenW } = useWindowDimensions();
  const [controlsVisible, setControlsVisible] = useState(true);
  const [tick, setTick] = useState(0); // bumped on every interaction to restart the auto-hide timer
  const [width, setWidth] = useState(1);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [scrub, setScrub] = useState<{ target: number; delta: number } | null>(null);
  const [showUnlock, setShowUnlock] = useState(false);

  const latest = useRef(p);
  latest.current = p;
  const scrubRef = useRef<number | null>(null);
  const startPos = useRef(0);
  const edgeIgnored = useRef(false);

  const failed = p.status === 'error';
  const loading = p.status === 'loading';
  const ready = p.status === 'ready';
  const hasDuration = p.durationSec > 0;
  const showControls = (controlsVisible || failed) && !p.locked;
  const progress = hasDuration ? p.positionSec / p.durationSec : 0;
  const bufferedRatio = hasDuration ? Math.min(1, p.bufferedSec / p.durationSec) : 0;

  const bump = useCallback(() => setTick((t) => t + 1), []);
  const act = (fn: () => void) => () => { bump(); fn(); };

  // Auto-hide: only while playing, nothing is open, and the user isn't scrubbing.
  useEffect(() => {
    if (!p.autoHide || !controlsVisible || !p.isPlaying || !ready || p.menuOpen || scrub || p.locked) return;
    const t = setTimeout(() => setControlsVisible(false), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [p.autoHide, controlsVisible, tick, p.isPlaying, ready, p.menuOpen, scrub, p.locked]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 600);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!showUnlock) return;
    const t = setTimeout(() => setShowUnlock(false), 2500);
    return () => clearTimeout(t);
  }, [showUnlock]);

  useEffect(() => { if (!p.locked) setShowUnlock(false); }, [p.locked]);

  const gestureEnabled = !p.locked && ready;

  const gesture = useMemo(() => {
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDelay(250)
      .runOnJS(true)
      .enabled(gestureEnabled && p.doubleTapSeek)
      .onEnd((e, success) => {
        if (!success) return;
        const cur = latest.current;
        const zone = tapZone(e.x, width);
        if (zone === 'left') {
          cur.onSeekBy(-cur.seekStepSec);
          setFlash({ zone, icon: 'play-back', id: Date.now() });
        } else if (zone === 'right') {
          cur.onSeekBy(cur.seekStepSec);
          setFlash({ zone, icon: 'play-forward', id: Date.now() });
        } else {
          setFlash({ zone, icon: cur.isPlaying ? 'pause' : 'play', id: Date.now() });
          cur.onTogglePlay();
        }
        setTick((t) => t + 1);
      });

    // A single tap toggles controls (or reveals the unlock button when the screen is locked).
    const singleTap = Gesture.Tap()
      .numberOfTaps(1)
      .runOnJS(true)
      .onEnd((_e, success) => {
        if (!success) return;
        if (latest.current.locked) setShowUnlock(true);
        else setControlsVisible((v) => !v);
      });

    // Horizontal swipe to seek. Vertical movement or edge touches never start a scrub, so
    // scrolling, the notification shade and system back gestures are left alone.
    const pan = Gesture.Pan()
      .runOnJS(true)
      .enabled(gestureEnabled && hasDuration && p.swipeSeek)
      .activeOffsetX([-18, 18])
      .failOffsetY([-14, 14])
      .onBegin((e) => { edgeIgnored.current = isEdgeTouch(e.absoluteX, screenW, EDGE_GUARD); })
      .onStart(() => { if (!edgeIgnored.current) startPos.current = latest.current.positionSec; })
      .onUpdate((e) => {
        if (edgeIgnored.current) return;
        const r = scrubTarget(startPos.current, e.translationX, width, latest.current.durationSec);
        scrubRef.current = r.target;
        setScrub(r);
      })
      .onEnd((_e, success) => {
        if (!edgeIgnored.current && success && scrubRef.current != null) latest.current.onSeekTo(scrubRef.current);
      })
      .onFinalize(() => { scrubRef.current = null; setScrub(null); });

    // Without double-tap, a single tap fires immediately instead of waiting to rule out a second tap.
    return Gesture.Race(pan, p.doubleTapSeek ? Gesture.Exclusive(doubleTap, singleTap) : singleTap);
  }, [gestureEnabled, hasDuration, width, screenW, p.doubleTapSeek, p.swipeSeek]);

  const signed = (d: number) => `${d >= 0 ? '+' : '−'}${formatTime(Math.abs(d))}`;

  return (
    <View style={[styles.surface, p.style]}>
      {p.videoLayer}

      <GestureDetector gesture={gesture}>
        <View
          style={StyleSheet.absoluteFill}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width || 1)}
          accessibilityLabel="Video. Tap to show or hide controls. Double-tap the left or right side to seek."
        />
      </GestureDetector>

      {flash && (
        <View
          pointerEvents="none"
          style={[styles.flashWrap, flash.zone === 'left' ? styles.flashLeft : flash.zone === 'right' ? styles.flashRight : styles.flashCenter]}
        >
          <View style={styles.flashPill}>
            <Ionicons name={flash.icon} size={26} color={colors.text} />
            {flash.zone !== 'center' && <Text style={styles.flashText}>{p.seekStepSec}s</Text>}
          </View>
        </View>
      )}

      {scrub && (
        <View pointerEvents="none" style={styles.scrubWrap}>
          <View style={styles.scrubPill}>
            <Text style={styles.scrubBig}>{formatTime(scrub.target)}</Text>
            <Text style={styles.scrubSmall}>{signed(scrub.delta)} · {formatTime(p.durationSec)}</Text>
          </View>
        </View>
      )}

      {loading && !showControls && !p.locked && (
        <View pointerEvents="none" style={styles.spinnerWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
      )}

      {p.locked && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {showUnlock && (
            <Pressable onPress={p.onUnlock} style={styles.unlock} accessibilityRole="button" accessibilityLabel="Unlock screen">
              <Ionicons name="lock-closed" size={20} color={colors.video} />
              <Text style={styles.unlockText}>Tap to unlock</Text>
            </Pressable>
          )}
        </View>
      )}

      {showControls && (
        <>
          <View style={styles.top} pointerEvents="box-none">
            <IconButton name="chevron-down" label={p.fullscreen ? 'Exit fullscreen' : 'Back to library'} size={28} onPress={act(p.onBack)} />
            {p.fullscreen ? <Text style={styles.topTitle} numberOfLines={1}>{p.title}</Text> : <View style={{ flex: 1 }} />}
            {p.rateLabel ? <Text style={styles.rate}>{p.rateLabel}</Text> : null}
            {p.fullscreen && (
              <IconButton name="lock-open-outline" label="Lock screen controls" onPress={act(() => { p.onLock(); setControlsVisible(false); })} disabled={failed} />
            )}
            <IconButton name="settings-outline" label="Playback speed" onPress={act(p.onSettings)} disabled={failed} />
          </View>

          {failed ? (
            <View style={styles.errorBox} pointerEvents="box-none">
              <Ionicons name="alert-circle-outline" size={34} color={colors.warning} />
              <Text style={styles.errorText}>{p.error?.message ?? "This video can't be played."}</Text>
              {p.error?.detail ? <Text style={styles.errorDetail} numberOfLines={2}>{p.error.detail}</Text> : null}
              <Pressable onPress={p.onRetry} style={styles.retry} accessibilityRole="button">
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
              {p.onSkipNext ? (
                <Pressable onPress={p.onSkipNext} style={styles.skip} accessibilityRole="button">
                  <Text style={styles.skipText}>Skip to next video</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.center} pointerEvents="box-none">
              <IconButton name="play-skip-back" label="Previous video" size={26} onPress={act(p.onPrev)} disabled={!ready} />
              <IconButton name="play-back" label={`Back ${p.seekStepSec} seconds`} size={28} onPress={act(() => p.onSeekBy(-p.seekStepSec))} disabled={!ready} />
              <View style={styles.playBtn}>
                {loading ? (
                  <ActivityIndicator color={colors.video} />
                ) : (
                  <IconButton name={p.isPlaying ? 'pause' : 'play'} label={p.isPlaying ? 'Pause' : 'Play'} size={34} color={colors.video} onPress={act(p.onTogglePlay)} disabled={!ready} />
                )}
              </View>
              <IconButton name="play-forward" label={`Forward ${p.seekStepSec} seconds`} size={28} onPress={act(() => p.onSeekBy(p.seekStepSec))} disabled={!ready} />
              <IconButton name="play-skip-forward" label="Next video" size={26} onPress={act(p.onNext)} disabled={!ready || !p.canNext} />
            </View>
          )}

          <View style={styles.bottom} pointerEvents="box-none">
            <View style={styles.timeRow}>
              <Text style={styles.time}>
                {formatTime(p.positionSec)} <Text style={styles.timeDim}>/ {hasDuration ? formatTime(p.durationSec) : '--:--'}</Text>
              </Text>
              <View style={styles.rightIcons}>
                {p.hasSubtitles && (
                  <IconButton
                    name={p.subtitlesOn ? 'chatbox-ellipses' : 'chatbox-ellipses-outline'}
                    label="Subtitles"
                    size={22}
                    color={p.subtitlesOn ? colors.primary : colors.text}
                    onPress={act(p.onSubtitles)}
                  />
                )}
                <IconButton name={p.fullscreen ? 'contract-outline' : 'expand-outline'} label={p.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} size={22} onPress={act(p.onToggleFullscreen)} />
              </View>
            </View>
            <ProgressBar
              progress={progress}
              buffered={bufferedRatio}
              onSeek={ready && hasDuration ? (r) => { bump(); p.onSeekRatio(r); } : undefined}
            />
          </View>
        </>
      )}

      {!showControls && !p.locked && ready && hasDuration && (
        <View pointerEvents="none" style={styles.mini}>
          <View style={[styles.miniFill, { width: `${progress * 100}%` }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { backgroundColor: colors.video, overflow: 'hidden' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.overlay },
  topTitle: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600', marginHorizontal: spacing.sm },
  rate: { color: colors.primary, fontSize: 13, fontWeight: '700', marginRight: spacing.xs },
  center: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  playBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  errorBox: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  errorText: { color: colors.text, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  errorDetail: { color: colors.textSecondary, fontSize: 11, textAlign: 'center' },
  retry: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.pill, marginTop: spacing.xs },
  retryText: { color: colors.video, fontWeight: '700' },
  skip: { paddingHorizontal: spacing.xl, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.primary },
  skipText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md, paddingBottom: spacing.xs, backgroundColor: colors.overlay },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { color: colors.text, fontSize: 12, fontWeight: '600' },
  timeDim: { color: colors.textSecondary, fontWeight: '400' },
  rightIcons: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  mini: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(248,250,252,0.2)' },
  miniFill: { height: 3, backgroundColor: colors.primary },
  flashWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'center' },
  flashLeft: { alignItems: 'flex-start', paddingLeft: '12%' },
  flashRight: { alignItems: 'flex-end', paddingRight: '12%' },
  flashCenter: { alignItems: 'center' },
  flashPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.secondary },
  flashText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  scrubWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scrubPill: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary },
  scrubBig: { color: colors.text, fontSize: 24, fontWeight: '800' },
  scrubSmall: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  spinnerWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  unlock: { position: 'absolute', left: spacing.xl, top: '45%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  unlockText: { color: colors.video, fontWeight: '700', fontSize: 13 },
});
