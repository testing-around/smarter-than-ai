import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, letters } from '../theme/colors';

interface Props {
  index: number;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}

export function ChoiceButton({ index, label, disabled, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.letter}>
        <Text style={styles.letterText}>{letters[index]}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.panel2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    minHeight: 80,
    flex: 1,
  },
  pressed: {
    borderColor: colors.cyan,
    backgroundColor: '#16314A',
  },
  disabled: {
    opacity: 0.4,
  },
  letter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: {
    color: colors.white,
    fontWeight: '800',
  },
  label: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 22,
    flex: 1,
  },
});
