import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme/colors';

type Props = { text: string; bottom: number };

export default function Toast({ text, bottom }: Props) {
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom }]}>
      <View style={styles.pill} accessibilityLiveRegion="polite">
        <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
        <Text style={styles.text} numberOfLines={3}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center', zIndex: 30, elevation: 30 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.secondary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, maxWidth: 480 },
  text: { color: colors.text, fontSize: 13, flexShrink: 1 },
});
