import { StyleSheet, Text, View } from 'react-native';
import { bannerHint, bannerLabel } from '../game/phases';
import { colors } from '../theme/colors';
import type { PhaseBannerId } from '../types';

export function PhaseBanner({ banner }: { banner: PhaseBannerId }) {
  const tone =
    banner === 'correct'
      ? colors.green
      : banner === 'wrong' || banner === 'error'
        ? colors.red
        : banner === 'listening' || banner === 'asking-armed'
          ? colors.cyan
          : banner === 'interrupt'
            ? colors.gold
            : banner === 'checking'
              ? colors.purple
              : banner === 'paused'
                ? colors.gold
                : colors.gold;
  const hint = bannerHint(banner);

  return (
    <View style={[styles.wrap, { borderColor: tone }]}>
      <Text style={[styles.label, { color: tone }]}>{bannerLabel(banner)}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.panel2,
    marginBottom: 10,
    alignItems: 'center',
  },
  label: {
    fontWeight: '900',
    letterSpacing: 1.4,
    fontSize: 13,
  },
  hint: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
    marginTop: 4,
  },
});
