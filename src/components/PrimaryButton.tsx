import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'cyan' | 'purple' | 'gold' | 'ghost' | 'danger';
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, variant = 'cyan', disabled }: Props) {
  if (variant === 'ghost' || variant === 'danger') {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.ghost,
          variant === 'danger' && styles.danger,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <Text style={[styles.ghostLabel, variant === 'danger' && { color: colors.red }]}>
          {label}
        </Text>
      </Pressable>
    );
  }

  const gradient: [string, string] =
    variant === 'gold'
      ? [colors.gold, '#E0A93A']
      : variant === 'purple'
        ? [colors.purple, '#5B3FE0']
        : [colors.cyan, '#1E9CA8'];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed, disabled && styles.disabled]}
    >
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
        <Text style={[styles.label, variant === 'gold' && { color: colors.bg }]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  ghost: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  danger: {
    borderColor: '#5A2A2A',
  },
  ghostLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
  row: {
    gap: 10,
  },
});
