import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme/colors';
import { MAX_CONTENT_WIDTH, type } from '../theme/typography';
import { ScreenProps } from '../types';
import { useUserData } from '../state/UserDataContext';
import { SPEEDS } from '../hooks/usePlayback';
import { keepAwakeAvailable } from '../services/keepAwake';
import { RESUME_MODES, ResumeMode, SEEK_STEP_OPTIONS } from '../utils/userData';
import IconButton from '../components/IconButton';
import OptionSheet from '../components/OptionSheet';
import SettingRow from '../components/SettingRow';
import StateView from '../components/StateView';
import Toast from '../components/Toast';

type Props = ScreenProps<'Settings'>;
type Sheet = null | 'speed' | 'resume' | 'step';

const RESUME_LABEL: Record<ResumeMode, string> = { ask: 'Ask me', always: 'Always resume', never: 'Never resume' };
const speedLabel = (r: number) => (r === 1 ? 'Normal (1×)' : `${r}×`);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export default function SettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const ud = useUserData();
  const s = ud.settings;
  const [sheet, setSheet] = useState<Sheet>(null);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const awakeOk = keepAwakeAvailable();

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);
  const say = (text: string) => setNotice({ id: Date.now(), text });

  const confirm = (title: string, message: string, label: string, run: () => void, done: string) =>
    Alert.alert(title, message, [
      { text: label, style: 'destructive', onPress: () => { run(); say(done); } },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const header = (
    <View style={styles.header}>
      <IconButton name="chevron-back" label="Back" size={28} onPress={() => navigation.goBack()} />
      <Text style={styles.headerTitle} accessibilityRole="header">Settings</Text>
    </View>
  );

  if (!ud.hydrated) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        <StateView kind="loading" message="Loading settings…" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl * 2 }]}>
        {ud.warning ? <Text style={styles.warn}>Settings may not be saved: {ud.warning}</Text> : null}

        <Text style={styles.section} accessibilityRole="header">Playback</Text>
        <View style={styles.card}>
          <SettingRow icon="speedometer-outline" title="Default playback speed" subtitle="Used when a video starts" value={`${ud.prefs.playbackRate}×`} onPress={() => setSheet('speed')} />
          <SettingRow icon="sync-outline" title="Remember speed changes" subtitle="Keep the speed you pick in the player as the new default" switchValue={s.rememberSpeed} onToggle={(v) => ud.updateSettings({ rememberSpeed: v })} />
          <SettingRow icon="time-outline" title="Resume playback" subtitle="What happens when a video you partly watched is opened" value={RESUME_LABEL[s.resumeMode]} onPress={() => setSheet('resume')} />
          <SettingRow icon="play-skip-forward-outline" title="Play next automatically" subtitle="Continue with the next video in the queue" switchValue={s.autoAdvance} onToggle={(v) => ud.updateSettings({ autoAdvance: v })} />
          <SettingRow
            icon="sunny-outline"
            title="Keep screen on"
            subtitle={awakeOk ? 'Stop the screen sleeping while a video plays' : 'Not available on this device'}
            switchValue={awakeOk ? s.keepScreenOn : false}
            disabled={!awakeOk}
            onToggle={(v) => ud.updateSettings({ keepScreenOn: v })}
            last
          />
        </View>

        <Text style={styles.section} accessibilityRole="header">Gestures and controls</Text>
        <View style={styles.card}>
          <SettingRow icon="hand-left-outline" title="Double-tap gestures" subtitle="Left or right side seeks, the middle plays or pauses" switchValue={s.doubleTapSeek} onToggle={(v) => ud.updateSettings({ doubleTapSeek: v })} />
          <SettingRow icon="swap-horizontal-outline" title="Swipe to seek" subtitle="Drag left or right on the video to scrub" switchValue={s.swipeSeek} onToggle={(v) => ud.updateSettings({ swipeSeek: v })} />
          <SettingRow icon="play-forward-outline" title="Seek step" subtitle="For double-tap and the skip buttons" value={`${s.seekStepSec} seconds`} onPress={() => setSheet('step')} />
          <SettingRow icon="eye-off-outline" title="Auto-hide controls" subtitle="Hide the controls a few seconds after playback starts" switchValue={s.autoHideControls} onToggle={(v) => ud.updateSettings({ autoHideControls: v })} last />
        </View>

        <Text style={styles.section} accessibilityRole="header">Data on this device</Text>
        <View style={styles.card}>
          <SettingRow
            icon="albums-outline"
            title="Clear watch history"
            subtitle={ud.history.length ? plural(ud.history.length, 'video') : 'Nothing to clear'}
            disabled={ud.history.length === 0}
            caution
            onPress={() => confirm('Clear watch history?', 'Your favorites and saved positions are kept.', 'Clear', ud.clearHistory, 'History cleared')}
          />
          <SettingRow
            icon="bookmark-outline"
            title="Clear saved positions"
            subtitle={ud.positionCount ? `${plural(ud.positionCount, 'video')} will start from the beginning` : 'Nothing to clear'}
            disabled={ud.positionCount === 0}
            caution
            onPress={() => confirm('Clear saved positions?', 'Videos will start from the beginning next time.', 'Clear', ud.clearAllPositions, 'Saved positions cleared')}
          />
          <SettingRow
            icon="refresh-outline"
            title="Reset settings"
            subtitle="Restore every setting above to its default"
            caution
            last
            onPress={() => confirm('Reset settings?', 'Favorites, history and your library are not affected.', 'Reset', ud.resetSettings, 'Settings reset')}
          />
        </View>

        <Text style={styles.about}>
          NovaPlay plays videos stored on this device. Favorites, history and settings stay on this device and are never uploaded.
        </Text>
      </ScrollView>

      {sheet === 'speed' ? (
        <OptionSheet
          title="Default playback speed"
          options={SPEEDS.map((r) => ({ key: String(r), label: speedLabel(r), selected: r === ud.prefs.playbackRate }))}
          onSelect={(k) => ud.setPrefs({ playbackRate: Number(k) })}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'resume' ? (
        <OptionSheet
          title="Resume playback"
          options={RESUME_MODES.map((m) => ({ key: m, label: RESUME_LABEL[m], selected: m === s.resumeMode }))}
          onSelect={(k) => ud.updateSettings({ resumeMode: k as ResumeMode })}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'step' ? (
        <OptionSheet
          title="Seek step"
          options={SEEK_STEP_OPTIONS.map((n) => ({ key: String(n), label: `${n} seconds`, selected: n === s.seekStepSec }))}
          onSelect={(k) => ud.updateSettings({ seekStepSec: Number(k) })}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {notice ? <Toast key={notice.id} text={notice.text} bottom={insets.bottom + spacing.lg} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  headerTitle: { ...type.title, color: colors.text },
  content: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: spacing.lg, gap: spacing.sm },
  section: { ...type.section, color: colors.secondary, marginTop: spacing.lg, marginBottom: spacing.xs, paddingHorizontal: spacing.xs },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden' },
  warn: { ...type.caption, color: colors.warning },
  about: { ...type.caption, color: colors.textSecondary, marginTop: spacing.xl, paddingHorizontal: spacing.xs },
});
