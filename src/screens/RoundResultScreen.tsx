import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ExitGameModal } from '../components/ExitGameModal';
import { HostBar } from '../components/HostBar';
import { Panel } from '../components/Panel';
import { PrimaryButton } from '../components/PrimaryButton';
import { Scoreboard } from '../components/Scoreboard';
import { Screen } from '../components/Screen';
import { useGame } from '../context/GameContext';
import { detectLeaders } from '../game/tieDetection';
import { colors, letters } from '../theme/colors';

export function RoundResultScreen() {
  const {
    lastResult,
    players,
    hostLine,
    continueAfterRound,
    questionNumber,
    questionTotal,
    canAdvance,
    hostSpeaking,
    settings,
    tiebreakActive,
    goHome,
    abandonActiveGame,
  } = useGame();
  const [leaveOpen, setLeaveOpen] = useState(false);

  if (!lastResult) {
    return (
      <Screen>
        <Text style={styles.title}>No result yet.</Text>
      </Screen>
    );
  }

  const leaders = detectLeaders(players);
  const atCap = questionNumber >= questionTotal;
  const nextLabel =
    !canAdvance && hostSpeaking
      ? 'Host is wrapping up…'
      : tiebreakActive || (atCap && leaders.isTie)
        ? 'Sudden death'
        : atCap && leaders.leaders.length === 1
          ? 'See champion'
          : 'Next question';
  const choice =
    lastResult.choiceIndex !== null
      ? `${letters[lastResult.choiceIndex]} · ${lastResult.question.choices[lastResult.choiceIndex]}`
      : 'No answer';
  const correctLabel = lastResult.question.correct_answer;

  return (
    <Screen>
      <Text style={styles.kicker}>
        ROUND RESULT · {questionNumber}/{questionTotal}
      </Text>
      <Text style={[styles.banner, lastResult.correct ? styles.yes : styles.no]}>
        {lastResult.source === 'skip'
          ? 'SKIPPED'
          : lastResult.source === 'host'
            ? 'REVEALED'
            : lastResult.correct
              ? 'CORRECT'
              : 'COMPLETE'}
      </Text>
      <Text style={styles.title}>
        {lastResult.playerName
          ? `${lastResult.playerName} answered`
          : 'Nobody claimed it'}
      </Text>
      <View style={{ height: 10 }} />
      <Panel gold={lastResult.isBoss}>
        <Text style={styles.q}>{lastResult.question.question}</Text>
        <Text style={styles.row}>Answered: {choice}</Text>
        <Text style={styles.row}>Correct: {correctLabel}</Text>
        <Text style={styles.row}>
          Points: {lastResult.points}
          {lastResult.isBoss ? ' · boss 3×' : ''}
        </Text>
        <Text style={styles.row}>Response: {lastResult.responseMs} ms</Text>
        <Text style={styles.row}>Source: {lastResult.source}</Text>
        <Text style={styles.explain}>{lastResult.question.explanation}</Text>
      </Panel>
      <View style={{ height: 12 }} />
      <Scoreboard players={players} highlightId={lastResult.playerId} preserveOrder />
      <View style={{ height: 12 }} />
      <HostBar
        line={hostLine}
        compact
        onHome={() => setLeaveOpen(true)}
      />
      <View style={{ height: 18 }} />
      <PrimaryButton
        label={nextLabel}
        disabled={settings.hostMode === 'FULL_AI_HOST' && !canAdvance}
        onPress={continueAfterRound}
      />
      <ExitGameModal
        visible={leaveOpen}
        onSaveAndExit={() => {
          setLeaveOpen(false);
          goHome();
        }}
        onExit={() => {
          setLeaveOpen(false);
          abandonActiveGame();
        }}
        onCancel={() => setLeaveOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: colors.muted,
    letterSpacing: 2,
    fontWeight: '800',
    fontSize: 12,
  },
  banner: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: 8,
  },
  yes: {
    color: colors.green,
  },
  no: {
    color: colors.red,
  },
  title: {
    color: colors.white,
    fontSize: 30,
    fontWeight: '900',
    marginTop: 4,
  },
  q: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 10,
    lineHeight: 24,
  },
  row: {
    color: colors.muted,
    marginBottom: 4,
  },
  explain: {
    color: colors.cyan,
    marginTop: 10,
    lineHeight: 20,
  },
});
