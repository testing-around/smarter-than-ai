import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

export function Panel({ children, gold = false }: { children: ReactNode; gold?: boolean }) {
  return <View style={[styles.panel, gold && styles.gold]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
  },
  gold: {
    borderColor: colors.gold,
    backgroundColor: colors.panel2,
  },
});
