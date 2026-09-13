import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

interface Props {
  children: ReactNode;
  scroll?: boolean;
}

export function Screen({ children, scroll = true }: Props) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + 10,
    paddingBottom: insets.bottom + 20,
    paddingHorizontal: 20,
  };

  if (!scroll) {
    return (
      <View style={styles.root}>
        <View style={[styles.inner, padding, { flex: 1 }]}>{children}</View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.inner, padding]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  inner: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    flexGrow: 1,
  },
});
