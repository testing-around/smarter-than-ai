import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import type { Player } from '../types';

export function Scoreboard({
  players,
  highlightId,
  preserveOrder = false,
}: {
  players: Player[];
  highlightId?: string | null;
  preserveOrder?: boolean;
}) {
  const ranked = preserveOrder ? players : [...players].sort((a, b) => b.score - a.score);
  return (
    <View style={styles.row}>
      {ranked.map((player) => {
        const hot = highlightId === player.id;
        return (
          <View key={player.id} style={[styles.chip, hot && styles.hot]}>
            <Text style={styles.emoji}>{player.emoji}</Text>
            <View>
              <Text style={styles.name} numberOfLines={1}>
                {player.name}
              </Text>
              <Text style={styles.score}>{player.score}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 96,
  },
  hot: {
    borderColor: colors.gold,
    backgroundColor: colors.panel2,
  },
  emoji: {
    fontSize: 18,
  },
  name: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
    maxWidth: 72,
  },
  score: {
    color: colors.gold,
    fontWeight: '800',
    fontSize: 13,
  },
});
