import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  line: string;
  compact?: boolean;
  paused?: boolean;
  onHome?: () => void;
  onPause?: () => void;
  onRepeat?: () => void;
  onSkip?: () => void;
  onSettings?: () => void;
}

export function HostBar({
  line,
  compact,
  paused,
  onHome,
  onPause,
  onRepeat,
  onSkip,
  onSettings,
}: Props) {
  return (
    <View style={styles.bar}>
      <Text style={styles.tag}>HOST</Text>
      <Text style={styles.line}>{line}</Text>
      {compact ? (
        <View style={styles.actions}>
          {onHome ? (
            <Pressable onPress={onHome} style={styles.action} accessibilityRole="button">
              <Text style={styles.actionText}>🏠 Home</Text>
            </Pressable>
          ) : null}
          {onPause ? (
            <Pressable onPress={onPause} style={styles.action} accessibilityRole="button">
              <Text style={styles.actionText}>{paused ? '▶ Resume' : '❚❚ Pause'}</Text>
            </Pressable>
          ) : null}
          {onRepeat ? (
            <Pressable onPress={onRepeat} style={styles.action} accessibilityRole="button">
              <Text style={styles.actionText}>↻ Repeat</Text>
            </Pressable>
          ) : null}
          {onSkip ? (
            <Pressable onPress={onSkip} style={styles.action} accessibilityRole="button">
              <Text style={styles.actionText}>⏭ Skip</Text>
            </Pressable>
          ) : null}
          {onSettings ? (
            <Pressable onPress={onSettings} style={styles.action} accessibilityRole="button">
              <Text style={styles.actionText}>⚙ Settings</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.panel2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  tag: {
    color: colors.cyan,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  line: {
    color: colors.white,
    fontWeight: '600',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  action: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  actionText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 12,
  },
});
