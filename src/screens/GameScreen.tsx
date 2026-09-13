import { StyleSheet, Text, View } from 'react-native';
import { ChoiceButton } from '../components/ChoiceButton';
import { HostBar } from '../components/HostBar';
import { Panel } from '../components/Panel';
import { PrimaryButton } from '../components/PrimaryButton';
import { Scoreboard } from '../components/Scoreboard';
import { Screen } from '../components/Screen';
import { WhoSaidThatModal } from '../components/WhoSaidThatModal';
import { useGame } from '../context/GameContext';
import { CATEGORY_LABEL } from '../data/bank';
import { difficultyBand } from '../data/questionAccess';
import { colors } from '../theme/colors';

export function GameScreen() {
  const {
    current,
    players,
    settings,
    questionNumber,
    questionTotal,
    timeLeft,
    locked,
    isBoss,
    multiplier,
    buzzedPlayerId,
    turnPlayerId,
    whoSaidThat,
    hostLine,
    transcript,
    listening,
    tapChoice,
    buzzIn,
    claimAnswer,
    listenNow,
    goHome,
  } = useGame();

  if (!current) {
    return (
      <Screen>
        <Text style={styles.title}>Loading question…</Text>
      </Screen>
    );
  }

  const turnPlayer = players.find((p) => p.id === turnPlayerId);
  const buzzed = players.find((p) => p.id === buzzedPlayerId);
  const choicesLocked =
    locked ||
    (settings.answerMode === 'buzz' && !buzzedPlayerId) ||
    Boolean(whoSaidThat);

  const timerColor =
    timeLeft <= 3 ? colors.red : timeLeft <= 6 ? colors.gold : colors.cyan;

  return (
    <Screen>
      <View style={styles.top}>
        <Text style={styles.kicker}>
          Q {questionNumber}/{questionTotal}
        </Text>
        <Text style={[styles.timer, { color: timerColor }]}>{timeLeft}s</Text>
      </View>
      <Scoreboard
        players={players}
        highlightId={settings.answerMode === 'turn' ? turnPlayerId : buzzedPlayerId}
      />
      <View style={{ height: 12 }} />
      <Panel gold={isBoss}>
        <View style={styles.tags}>
          <Text style={styles.tag}>{CATEGORY_LABEL[current.category]}</Text>
          {current.subcategory ? <Text style={styles.tag}>{current.subcategory}</Text> : null}
          <Text style={styles.tag}>
            {difficultyBand(current.difficulty).toUpperCase()} · {current.difficulty}/10
          </Text>
          {current.question_type !== 'MULTIPLE_CHOICE' ? (
            <Text style={styles.tag}>{current.question_type.replace('_', ' ')}</Text>
          ) : null}
          {isBoss ? <Text style={styles.boss}>BOSS ROUND · {multiplier}×</Text> : null}
        </View>
        <Text style={styles.prompt}>{current.question}</Text>
      </Panel>

      {settings.answerMode === 'turn' ? (
        <Text style={styles.hint}>Turn: {turnPlayer ? `${turnPlayer.emoji} ${turnPlayer.name}` : '—'}</Text>
      ) : null}
      {settings.answerMode === 'buzz' ? (
        <Text style={styles.hint}>
          {buzzed ? `${buzzed.emoji} ${buzzed.name} buzzed in` : 'Buzz first, then answer'}
        </Text>
      ) : (
        <Text style={styles.hint}>Shout a letter, or tap. Name-then-answer works too.</Text>
      )}

      {settings.answerMode === 'buzz' && !buzzedPlayerId ? (
        <View style={styles.buzzRow}>
          {players
            .filter((p) => !p.isAi)
            .map((player) => (
              <View key={player.id} style={{ flex: 1 }}>
                <PrimaryButton
                  label={`${player.emoji} Buzz`}
                  variant="purple"
                  onPress={() => buzzIn(player.id)}
                />
              </View>
            ))}
        </View>
      ) : null}

      <View style={styles.grid}>
        {current.choices.map((choice, index) => (
          <View key={choice} style={styles.cell}>
            <ChoiceButton
              index={index}
              label={choice}
              disabled={choicesLocked}
              onPress={() => tapChoice(index)}
            />
          </View>
        ))}
      </View>

      <View style={{ height: 12 }} />
      <HostBar line={listening ? `${hostLine} · listening` : hostLine} />
      {transcript ? <Text style={styles.heard}>Heard: {transcript}</Text> : null}
      <View style={{ height: 10 }} />
      {settings.voiceEnabled ? (
        <PrimaryButton label={listening ? 'Listening…' : 'Listen now'} onPress={listenNow} />
      ) : null}
      <View style={{ height: 8 }} />
      <PrimaryButton label="Quit to home" variant="ghost" onPress={goHome} />

      <WhoSaidThatModal
        visible={Boolean(whoSaidThat)}
        transcript={whoSaidThat?.transcript ?? ''}
        choiceIndex={whoSaidThat?.choiceIndex ?? 0}
        choiceLabel={current.choices[whoSaidThat?.choiceIndex ?? 0] ?? ''}
        players={players}
        onClaim={claimAnswer}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  kicker: {
    color: colors.muted,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  timer: {
    fontSize: 28,
    fontWeight: '900',
  },
  title: {
    color: colors.white,
    fontWeight: '800',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  tag: {
    color: colors.cyan,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
  },
  boss: {
    color: colors.gold,
    fontWeight: '900',
    letterSpacing: 1,
    fontSize: 11,
  },
  prompt: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  hint: {
    color: colors.muted,
    marginVertical: 10,
  },
  buzzRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    width: '48%',
    flexGrow: 1,
    minWidth: 140,
  },
  heard: {
    color: colors.green,
    marginTop: 8,
  },
});
