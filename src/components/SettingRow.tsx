import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import { MIN_TOUCH, type } from '../theme/typography';

type Props = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  value?: string; // shown on the right for rows that open a chooser
  switchValue?: boolean; // present => this row is a switch
  onToggle?: (next: boolean) => void;
  onPress?: () => void;
  disabled?: boolean;
  caution?: boolean; // destructive-style action (amber, never red)
  last?: boolean;
};

export default function SettingRow({ icon, title, subtitle, value, switchValue, onToggle, onPress, disabled, caution, last }: Props) {
  const isSwitch = switchValue !== undefined;
  const tint = caution ? colors.warning : colors.primary;
  const act = () => { if (!disabled) (isSwitch ? onToggle?.(!switchValue) : onPress?.()); };
  return (
    <Pressable
      onPress={act}
      disabled={disabled}
      accessibilityRole={isSwitch ? 'switch' : 'button'}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityValue={value ? { text: value } : undefined}
      accessibilityState={isSwitch ? { checked: switchValue, disabled: !!disabled } : { disabled: !!disabled }}
      style={({ pressed }) => [styles.row, !last && styles.divider, { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}
    >
      <Ionicons name={icon} size={22} color={tint} />
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      {isSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onToggle}
          disabled={disabled}
          trackColor={{ false: colors.border, true: colors.secondary }}
          thumbColor={switchValue ? colors.primary : colors.textSecondary}
          accessible={false}
        />
      ) : value ? (
        <View style={styles.valueWrap}>
          <Text style={styles.value}>{value}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH + 8, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  text: { flex: 1, gap: 2 },
  title: { ...type.body, color: colors.text },
  sub: { ...type.caption, color: colors.textSecondary },
  valueWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  value: { ...type.label, color: colors.primary },
});
