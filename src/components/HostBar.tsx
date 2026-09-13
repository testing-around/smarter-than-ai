import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export function HostBar({ line }: { line: string }) {
  return (
    <View style={styles.bar}>
      <Text style={styles.tag}>HOST</Text>
      <Text style={styles.line}>{line}</Text>
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
});
