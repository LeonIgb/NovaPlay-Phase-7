import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

type Props = {
  name: React.ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
  label: string;
  size?: number;
  color?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function IconButton({ name, onPress, label, size = 24, color = colors.text, disabled, style }: Props) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={10}
      style={({ pressed }) => [{ padding: 6, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }, style]}
    >
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}
