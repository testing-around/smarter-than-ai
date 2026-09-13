import { StyleSheet, Text, View } from 'react-native';
import { colors, letters } from '../theme/colors';
import type { QuestionAttempt } from '../types';

export function WrongAttemptCard({ attempt }: { attempt: QuestionAttempt }) {
  const choice =
    attempt.answerChoice !== null
      ? `${letters[attempt.answerChoice] ?? '?'} · ${attempt.answer}`
      : attempt.answer;
  return (
    <View style={styles.card}>
      <Text style={styles.banner}>❌ {attempt.playerName.toUpperCase()} — WRONG</Text>
      <Text style={styles.body}>{choice}</Text>
      <Text style={styles.keep}>Question remains live…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.red,
    backgroundColor: colors.panel,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  banner: {
    color: colors.red,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  body: {
    color: colors.white,
    fontWeight: '800',
    marginTop: 4,
  },
  keep: {
    color: colors.muted,
    marginTop: 4,
    fontWeight: '700',
  },
});
