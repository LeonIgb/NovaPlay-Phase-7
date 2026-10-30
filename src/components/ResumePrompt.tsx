import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme/colors';
import { formatTime } from '../utils/format';

type Props = { positionSec: number; onResume: () => void; onRestart: () => void };

// Sits over the video while playback waits for the choice.
export default function ResumePrompt({ positionSec, onResume, onRestart }: Props) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <Pressable onPress={onResume} style={styles.primary} accessibilityRole="button" accessibilityLabel={`Resume from ${formatTime(positionSec)}`}>
          <Text style={styles.primaryText}>Resume {formatTime(positionSec)}</Text>
        </Pressable>
        <Pressable onPress={onRestart} style={styles.secondary} accessibilityRole="button" accessibilityLabel="Start over">
          <Text style={styles.secondaryText}>Start over</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 58, zIndex: 15 },
  card: { flexDirection: 'row', gap: spacing.sm, backgroundColor: 'rgba(28,37,48,0.95)', borderRadius: radius.pill, padding: spacing.sm, borderWidth: 1, borderColor: colors.secondary },
  primary: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  primaryText: { color: colors.video, fontWeight: '700', fontSize: 13 },
  secondary: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  secondaryText: { color: colors.text, fontWeight: '600', fontSize: 13 },
});
