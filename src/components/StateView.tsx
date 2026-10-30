import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme/colors';

type Props = {
  kind: 'loading' | 'empty' | 'error';
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function StateView({ kind, title, message, actionLabel, onAction }: Props) {
  const icon = kind === 'error' ? 'alert-circle-outline' : 'film-outline';
  const iconColor = kind === 'error' ? colors.warning : colors.secondary;
  return (
    <View style={styles.wrap}>
      {kind === 'loading' ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <Ionicons name={icon} size={56} color={iconColor} />
      )}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {message ? <Text style={styles.msg}>{message}</Text> : null}
      {actionLabel ? (
        <Pressable onPress={onAction} style={styles.btn} accessibilityRole="button">
          <Text style={styles.btnText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  msg: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  btn: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.sm },
  btnText: { color: colors.video, fontWeight: '700' },
});
