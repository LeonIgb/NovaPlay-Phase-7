import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme/colors';
import { AccessState } from '../services/mediaLibraryService';

type Props = {
  access: AccessState;
  detail: string | null;
  scanError: string | null;
  onAllow: () => void;
  onOpenSettings: () => void;
  onRetry: () => void;
};

export default function AccessBanner({ access, detail, scanError, onAllow, onOpenSettings, onRetry }: Props) {
  let icon: React.ComponentProps<typeof Ionicons>['name'] = 'folder-open-outline';
  let title = '';
  let text = '';
  let action: { label: string; onPress: () => void } | null = null;

  if (scanError) {
    icon = 'alert-circle-outline';
    title = "Couldn't scan this device";
    text = scanError;
    action = { label: 'Try again', onPress: onRetry };
  } else if (access === 'unknown') {
    title = 'Find videos on this device';
    text = 'Allow video access and NovaPlay will list the videos Android shares with apps. You can also add files by hand.';
    action = { label: 'Allow access', onPress: onAllow };
  } else if (access === 'denied') {
    title = 'Video access was denied';
    text = 'Without it, only videos you add with the file picker appear here.';
    action = { label: 'Allow access', onPress: onAllow };
  } else if (access === 'blocked') {
    title = 'Video access is turned off';
    text = 'Android will not ask again. Turn it on in the app settings to scan this device.';
    action = { label: 'Open settings', onPress: onOpenSettings };
  } else if (access === 'unsupported') {
    icon = 'information-circle-outline';
    title = "Device scan isn't available here";
    text = `This environment can't grant media access${detail ? ` (${detail})` : ''}. Add videos with the file picker instead.`;
  } else {
    return null;
  }

  return (
    <View style={styles.card}>
      <Ionicons name={icon} size={22} color={scanError ? colors.warning : colors.secondary} />
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text} numberOfLines={4}>{text}</Text>
        {action ? (
          <Pressable onPress={action.onPress} style={styles.btn} accessibilityRole="button">
            <Text style={styles.btnText}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.md },
  body: { flex: 1, gap: 4 },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  text: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  btn: { alignSelf: 'flex-start', backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: 6, borderRadius: radius.pill, marginTop: spacing.xs },
  btnText: { color: colors.video, fontWeight: '700', fontSize: 13 },
});
