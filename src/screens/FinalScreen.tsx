import { StyleSheet, Text, View } from 'react-native';
import { AiHostOrb } from '../components/AiHostOrb';
import { HostBar } from '../components/HostBar';
import { Panel } from '../components/Panel';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { useGame } from '../context/GameContext';
import { colors } from '../theme/colors';

export function FinalScreen() {
  const { players, results, hostLine, rematch, goHome, goSetup } = useGame();
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const champ = ranked[0];
  const correctCount = results.filter((r) => r.correct).length;

  return (
    <Screen>
      <Text style={styles.kicker}>FINAL</Text>
      <Text style={styles.title}>
        {champ ? `${champ.emoji} ${champ.name} wins` : 'That’s a wrap'}
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
          {correctCount}/{results.length} questions answered correctly · rematch keeps these
          players and rules
        </Text>
      </Panel>
      <View style={{ height: 18 }} />
      <PrimaryButton label="Rematch" variant="gold" onPress={rematch} />
      <View style={{ height: 10 }} />
      <PrimaryButton label="New setup" onPress={goSetup} />
      <View style={{ height: 10 }} />
      <PrimaryButton label="Home" variant="ghost" onPress={goHome} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: colors.gold,
    letterSpacing: 3,
    fontWeight: '800',
    fontSize: 12,
  },
  title: {
    color: colors.white,
    fontSize: 32,
    fontWeight: '900',
    marginTop: 4,
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
});
