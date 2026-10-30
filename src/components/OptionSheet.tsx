import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme/colors';

export type Option = { key: string; label: string; selected: boolean };
type Props = { title: string; options: Option[]; onSelect: (key: string) => void; onClose: () => void };

// In-tree overlay (not a Modal) so Android system bars stay hidden while in fullscreen.
export default function OptionSheet({ title, options, onSelect, onClose }: Props) {
  return (
    <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu">
      <Pressable style={styles.sheet} onPress={() => {}}>
        <Text style={styles.title}>{title}</Text>
        <ScrollView>
          {options.map((o) => (
            <Pressable key={o.key} style={styles.row} onPress={() => { onSelect(o.key); onClose(); }} accessibilityRole="button" accessibilityLabel={o.label}>
              <Text style={[styles.label, o.selected && styles.active]}>{o.label}</Text>
              {o.selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
            </Pressable>
          ))}
        </ScrollView>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl, zIndex: 20, elevation: 20 },
  sheet: { width: '100%', maxWidth: 360, maxHeight: '90%', backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: spacing.md },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  label: { color: colors.textSecondary, fontSize: 15 },
  active: { color: colors.primary, fontWeight: '700' },
});
