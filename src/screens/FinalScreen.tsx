import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { AiHostOrb } from '../components/AiHostOrb';
import { HostBar } from '../components/HostBar';
import { Panel } from '../components/Panel';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { APP_NAME_SHORT } from '../branding';
import { useGame } from '../context/GameContext';
import { colors } from '../theme/colors';

const BURST = ['🏆', '✨', '🎉', '⭐', '🎊', '🏆'];

export function FinalScreen() {
  const { players, results, hostLine, rematch, playAgain, goHome, goSetup } = useGame();
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const champ = ranked[0];
  const correctCount = results.filter((r) => r.correct).length;
  const [showResults, setShowResults] = useState(false);
  const pulse = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.94, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Screen>
      <Text style={styles.brand}>{APP_NAME_SHORT}</Text>
      <Text style={styles.kicker}>🏆 CHAMPION</Text>
      <View style={styles.confetti}>
        {BURST.map((bit, index) => (
          <Text key={`${bit}-${index}`} style={styles.confettiBit}>
            {bit}
          </Text>
        ))}
      </View>
      <Animated.Text style={[styles.title, { transform: [{ scale: pulse }] }]}>
        {champ ? `${champ.emoji} ${champ.name}` : 'That’s a wrap'}
      </Animated.Text>
      <Text style={styles.sub}>
        {champ ? `${champ.name} is the ${APP_NAME_SHORT} winner` : 'No champion this time'}
      </Text>
      <AiHostOrb caption="CHAMPION" listening={false} />
      <HostBar line={hostLine} />
      <View style={{ height: 14 }} />
      <Panel gold>
        {ranked.map((player, index) => (
          <View key={player.id} style={styles.row}>
            <Text style={styles.place}>{index + 1}</Text>
            <Text style={styles.emoji}>{player.emoji}</Text>
            <Text style={styles.name}>{player.name}</Text>
            <Text style={styles.score}>{player.score}</Text>
          </View>
        ))}
        <Text style={styles.meta}>
          {correctCount}/{results.length} questions answered correctly
        </Text>
      </Panel>
      {showResults ? (
        <Panel>
          <Text style={styles.resultsTitle}>ROUND LOG</Text>
          {results.map((row, index) => (
            <Text key={`${row.question.question_id}-${index}`} style={styles.resultLine}>
              {index + 1}. {row.playerName ?? '—'} · {row.correct ? '✓' : '–'} ·{' '}
              {row.question.correct_answer}
            </Text>
          ))}
        </Panel>
      ) : null}
      <View style={{ height: 18 }} />
      <PrimaryButton label="Play again" variant="gold" onPress={playAgain} />
      <View style={{ height: 10 }} />
      <PrimaryButton label="Rematch" onPress={rematch} />
      <View style={{ height: 10 }} />
      <PrimaryButton label="New players" variant="ghost" onPress={goSetup} />
      <View style={{ height: 10 }} />
      <PrimaryButton
        label={showResults ? 'Hide results' : 'View results'}
        variant="ghost"
        onPress={() => setShowResults((open) => !open)}
      />
      <View style={{ height: 10 }} />
      <PrimaryButton label="Home" variant="ghost" onPress={goHome} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: colors.gold,
    letterSpacing: 3,
    fontWeight: '900',
    fontSize: 13,
  },
  kicker: {
    color: colors.gold,
    letterSpacing: 3,
    fontWeight: '800',
    fontSize: 12,
    marginTop: 4,
  },
  confetti: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  confettiBit: {
    fontSize: 28,
  },
  title: {
    color: colors.white,
    fontSize: 36,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'center',
  },
  sub: {
    color: colors.cyan,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  place: {
    color: colors.gold,
    width: 18,
    fontWeight: '900',
  },
  emoji: {
    fontSize: 22,
    width: 28,
  },
  name: {
    color: colors.white,
    flex: 1,
    fontWeight: '800',
    fontSize: 18,
  },
  score: {
    color: colors.cyan,
    fontWeight: '900',
    fontSize: 20,
  },
  meta: {
    color: colors.muted,
    marginTop: 12,
    lineHeight: 20,
  },
  resultsTitle: {
    color: colors.gold,
    fontWeight: '800',
    marginBottom: 8,
  },
  resultLine: {
    color: colors.white,
    marginBottom: 6,
    fontWeight: '600',
  },
});
