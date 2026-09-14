import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AiHostOrb } from '../components/AiHostOrb';
import { HostBar } from '../components/HostBar';
import { Panel } from '../components/Panel';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { useGame } from '../context/GameContext';
import { colors } from '../theme/colors';
import type { QuickModeId } from '../types';

const MODES: { id: QuickModeId; title: string; blurb: string }[] = [
  { id: 'family', title: 'Family Battle', blurb: '10 questions · shout out · early interrupt' },
  { id: 'lightning', title: 'Lightning', blurb: '5 questions · 8s · early shout-out' },
  { id: 'beatAi', title: 'Beat the AI', blurb: 'AI plays too. Humans can interrupt the host.' },
  { id: 'grade', title: 'Grade Challenge', blurb: 'Hard mode · turn based · 20s' },
];

export function HomeScreen() {
  const {
    goSetup,
    goPastGames,
    applyQuickMode,
    leaderboard,
    hostLine,
    activeSessionSummary,
    crashRecovery,
    continueSavedGame,
    dismissCrashRecovery,
  } = useGame();

  return (
    <Screen>
      <Text style={styles.eyebrow}>ARE YOU</Text>
      <Text style={styles.hero}>SMARTER{'\n'}THEN AI?</Text>
      <Text style={styles.sub}>
        Multiplayer trivia. Enter names, shout the letter, and let the host credit the right
        player.
      </Text>
      <AiHostOrb />
      <HostBar line={hostLine} />
      <View style={{ height: 16 }} />
      {crashRecovery ? (
        <Panel>
          <Text style={styles.modeTitle}>Resume interrupted game?</Text>
          <Text style={styles.modeBlurb}>
            {crashRecovery.name} · Q {crashRecovery.questionNumber}/{crashRecovery.questionTotal}
          </Text>
          <View style={{ height: 10 }} />
          <PrimaryButton
            label="Continue game"
            variant="gold"
            onPress={() => continueSavedGame(crashRecovery.id)}
          />
          <View style={{ height: 8 }} />
          <PrimaryButton label="Not now" variant="ghost" onPress={dismissCrashRecovery} />
        </Panel>
      ) : null}
      {activeSessionSummary && !crashRecovery ? (
        <PrimaryButton
          label="Continue game"
          variant="gold"
          onPress={() => continueSavedGame(activeSessionSummary.id)}
        />
      ) : null}
      <View style={{ height: 10 }} />
      <PrimaryButton label="New game" onPress={goSetup} />
      <View style={{ height: 10 }} />
      <PrimaryButton label="Past games" variant="ghost" onPress={goPastGames} />
      <Text style={styles.section}>QUICK MODES</Text>
      <View style={styles.modeGrid}>
        {MODES.map((mode) => (
          <Pressable key={mode.id} onPress={() => applyQuickMode(mode.id)} style={styles.mode}>
            <Text style={styles.modeTitle}>{mode.title}</Text>
            <Text style={styles.modeBlurb}>{mode.blurb}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.section}>FAMILY LEADERBOARD</Text>
      <Panel>
        {leaderboard.slice(0, 5).map((row, index) => (
          <View key={row.name} style={styles.boardRow}>
            <Text style={styles.rank}>{index + 1}</Text>
            <Text style={styles.emoji}>{row.emoji}</Text>
            <Text style={styles.boardName}>{row.name}</Text>
            <Text style={styles.wins}>{row.wins} wins</Text>
            <Text style={styles.last}>{row.lastScore}</Text>
          </View>
        ))}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: colors.cyan,
    letterSpacing: 4,
    fontWeight: '800',
    fontSize: 13,
  },
  hero: {
    color: colors.white,
    fontSize: 46,
    lineHeight: 48,
    fontWeight: '900',
    marginTop: 4,
  },
  sub: {
    color: colors.muted,
    marginTop: 10,
    lineHeight: 21,
  },
  section: {
    color: colors.muted,
    letterSpacing: 2,
    fontWeight: '800',
    fontSize: 12,
    marginTop: 22,
    marginBottom: 10,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  mode: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    minHeight: 96,
  },
  modeTitle: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 6,
  },
  modeBlurb: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  rank: {
    color: colors.gold,
    width: 16,
    fontWeight: '800',
  },
  emoji: {
    fontSize: 18,
    width: 24,
  },
  boardName: {
    color: colors.white,
    flex: 1,
    fontWeight: '700',
  },
  wins: {
    color: colors.muted,
    fontSize: 12,
  },
  last: {
    color: colors.cyan,
    fontWeight: '800',
    width: 48,
    textAlign: 'right',
  },
});
