import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme/colors';
import IconButton from './IconButton';

type Props = { value: string; onChange: (text: string) => void };

export default function SearchBar({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search videos"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel="Search videos"
      />
      {value ? <IconButton name="close-circle" label="Clear search" size={18} color={colors.textSecondary} onPress={() => onChange('')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: spacing.md, marginHorizontal: spacing.lg, height: 42 },
  input: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 0 },
});
