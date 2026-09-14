import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, letters } from '../theme/colors';
import type { PendingAnswer, Player } from '../types';
import { PrimaryButton } from './PrimaryButton';

export type ClickerWho = string | 'ai' | 'unknown';

interface Props {
  pending: PendingAnswer;
  choiceLabel: string;
  players: Player[];
  who: ClickerWho | null;
  correctOverride: boolean | null;
  onWho: (who: ClickerWho) => void;
  onCorrect: (value: boolean | null) => void;
  onConfirm: () => void;
}

export function ClickerPanel({
  pending,
  choiceLabel,
  players,
  who,
  correctOverride,
  onWho,
  onCorrect,
  onConfirm,
}: Props) {
  const letter = letters[pending.choiceIndex] ?? '?';
  const verdict =
    correctOverride === null
      ? pending.suggestedCorrect
        ? 'AI suggests CORRECT'
        : 'AI suggests WRONG'
      : correctOverride
        ? 'Marked CORRECT'
        : 'Marked WRONG';

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>HOST ASSIST · WHO ANSWERED?</Text>
      <Text style={styles.title}>
        Who said {choiceLabel || pending.transcript || 'that'}?
      </Text>
      <Text style={styles.heard}>
        Heard {letter} — {choiceLabel}
      </Text>
      {pending.transcript ? <Text style={styles.quote}>“{pending.transcript}”</Text> : null}
      {pending.overlap === 'MULTIPLE_SPEAKERS' ? (
        <Text style={styles.warn}>Multiple names heard — pick the speaker.</Text>
      ) : null}
      <Text style={styles.hint}>{verdict}</Text>
      <View style={styles.row}>
        {players
          .filter((p) => !p.isAi)
          .map((player) => (
            <Pressable
              key={player.id}
              onPress={() => onWho(player.id)}
              style={[styles.chip, who === player.id && styles.chipOn]}
            >
              <Text style={styles.chipText}>
                {player.emoji} {player.name}
              </Text>
            </Pressable>
          ))}
        <Pressable
          onPress={() => onWho('ai')}
          style={[styles.chip, who === 'ai' && styles.chipOn]}
        >
          <Text style={styles.chipText}>AI GOT IT</Text>
        </Pressable>
        <Pressable
          onPress={() => onWho('unknown')}
          style={[styles.chip, who === 'unknown' && styles.chipOn]}
        >
          <Text style={styles.chipText}>UNKNOWN</Text>
        </Pressable>
      </View>
      <Text style={styles.kicker}>CORRECT?</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => onCorrect(true)}
          style={[styles.chip, correctOverride === true && styles.yes]}
        >
          <Text style={styles.chipText}>YES</Text>
        </Pressable>
        <Pressable
          onPress={() => onCorrect(false)}
          style={[styles.chip, correctOverride === false && styles.no]}
        >
          <Text style={styles.chipText}>NO</Text>
        </Pressable>
        <Pressable
          onPress={() => onCorrect(null)}
          style={[styles.chip, correctOverride === null && styles.chipOn]}
        >
          <Text style={styles.chipText}>USE AI SUGGESTION</Text>
        </Pressable>
      </View>
      <PrimaryButton
        label="Confirm answer"
        variant="gold"
        disabled={!who || who === 'unknown'}
        onPress={onConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 8,
    marginTop: 10,
  },
  kicker: {
    color: colors.gold,
    fontWeight: '800',
    letterSpacing: 1.4,
    fontSize: 11,
  },
  title: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 20,
  },
  heard: {
    color: colors.cyan,
    fontWeight: '800',
  },
  quote: {
    color: colors.white,
  },
  warn: {
    color: colors.gold,
    fontWeight: '700',
  },
  hint: {
    color: colors.muted,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.panel2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    minHeight: 76,
    minWidth: 120,
    justifyContent: 'center',
  },
  chipOn: {
    borderColor: colors.cyan,
  },
  yes: {
    borderColor: colors.green,
  },
  no: {
    borderColor: colors.red,
  },
  chipText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 16,
  },
});
