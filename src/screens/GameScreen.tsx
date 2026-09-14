import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { ChipSelect } from '../components/ChipSelect';
import { ChoiceButton } from '../components/ChoiceButton';
import { ClickerPanel } from '../components/ClickerPanel';
import { EventLogPanel } from '../components/EventLogPanel';
import { ExitGameModal } from '../components/ExitGameModal';
import { HostBar } from '../components/HostBar';
import { HostControls } from '../components/HostControls';
import { Panel } from '../components/Panel';
import { PhaseBanner } from '../components/PhaseBanner';
import { PrimaryButton } from '../components/PrimaryButton';
import { Scoreboard } from '../components/Scoreboard';
import { Screen } from '../components/Screen';
import { WhoSaidThatModal } from '../components/WhoSaidThatModal';
import { WrongAttemptCard } from '../components/WrongAttemptCard';
import { useGame } from '../context/GameContext';
import { isEarlyAnswerArmed, isEarlyShoutArmed } from '../game/earlyShout';
import { canAcceptAnswers } from '../game/phases';
import { CATEGORY_LABEL } from '../data/bank';
import { difficultyBand } from '../data/questionAccess';
import { colors } from '../theme/colors';
import type { HostPersonality } from '../types';

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
    phase,
    banner,
    hostSpeaking,
    pendingAnswer,
    clickerOpen,
    clickerWho,
    clickerCorrect,
    paused,
    eventLog,
    interruptAlert,
    wrongOverlay,
    lockoutPlayerIds,
    resumeCountdown,
    tapChoice,
    buzzIn,
    claimAnswer,
    listenNow,
    goHome,
    abandonActiveGame,
    patchSettings,
    tiebreakActive,
    tiebreakLeaderIds,
    pauseRound,
    resumeRound,
    repeatQuestion,
    skipQuestion,
    revealAnswer,
    identifyPlayer,
    saveGameNow,
    stopHostSpeaking,
    retryHostSpeech,
    skipToListening,
    setClickerWho,
    setClickerCorrect,
    confirmClicker,
  } = useGame();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!current) {
    return (
      <Screen>
        <Text style={styles.title}>Loading question…</Text>
      </Screen>
    );
  }

  const seated = players;
  const livePlayers =
    tiebreakActive && tiebreakLeaderIds.length
      ? seated.filter((p) => tiebreakLeaderIds.includes(p.id) || p.isAi)
      : seated;
  const turnPlayer = seated.find((p) => p.id === turnPlayerId);
  const buzzed = seated.find((p) => p.id === buzzedPlayerId);
  const earlyTap = isEarlyAnswerArmed(settings);
  const earlyVoice = isEarlyShoutArmed(settings);
  const acceptingTaps =
    canAcceptAnswers(phase, earlyTap) && !paused && (!hostSpeaking || earlyTap);
  const acceptingVoice =
    canAcceptAnswers(phase, earlyVoice) && !paused && (!hostSpeaking || earlyVoice);
  const choicesLocked =
    locked ||
    !acceptingTaps ||
    (settings.answerMode === 'buzz' && !buzzedPlayerId) ||
    Boolean(whoSaidThat) ||
    clickerOpen;

  const timerArmed = phase === 'LISTENING_FOR_PLAYERS';
  const timerColor =
    !timerArmed ? colors.muted : timeLeft <= 3 ? colors.red : timeLeft <= 6 ? colors.gold : colors.cyan;
  const showTtsRecovery = phase === 'TTS_ERROR' || phase === 'HOST_STOPPED';

  return (
    <Screen>
      <View style={styles.top}>
        <Text style={styles.kicker}>
          {tiebreakActive ? 'TIEBREAK' : `Q ${questionNumber}/${questionTotal}`}
        </Text>
        <Text style={[styles.timer, { color: timerColor }]}>
          {timerArmed ? `${timeLeft}s` : '—'}
        </Text>
      </View>
      <PhaseBanner banner={banner} />
      {resumeCountdown !== null ? (
        <View style={styles.alert}>
          <Text style={styles.alertTitle}>RESUMING IN {resumeCountdown}</Text>
          <Text style={styles.alertBody}>Host will re-read the question, then listen.</Text>
        </View>
      ) : null}
      {wrongOverlay ? <WrongAttemptCard attempt={wrongOverlay} /> : null}
      {interruptAlert ? (
        <View style={styles.alert}>
          <Text style={styles.alertTitle}>⚡ ANSWER HEARD!</Text>
          <Text style={styles.alertBody}>
            Someone answered while the host was speaking. Pick who said it.
          </Text>
        </View>
      ) : null}
      {tiebreakActive ? (
        <View style={styles.alert}>
          <Text style={styles.alertTitle}>SUDDEN DEATH</Text>
          <Text style={styles.alertBody}>Only the tied leaders can answer until one winner.</Text>
        </View>
      ) : null}
      <Scoreboard
        players={seated}
        highlightId={settings.answerMode === 'turn' ? turnPlayerId : buzzedPlayerId}
        preserveOrder
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
      {lockoutPlayerIds.length ? (
        <Text style={styles.hint}>
          Locked this question:{' '}
          {players
            .filter((p) => lockoutPlayerIds.includes(p.id))
            .map((p) => p.name)
            .join(', ')}
        </Text>
      ) : null}
      {settings.answerMode === 'buzz' ? (
        <Text style={styles.hint}>
          {buzzed ? `${buzzed.emoji} ${buzzed.name} buzzed in` : 'Buzz after the host finishes'}
        </Text>
      ) : (
        <Text style={styles.hint}>
          {interruptAlert
            ? 'Who said that? Tap the player (Host + Clicker) or claim the shout.'
            : acceptingTaps
              ? earlyTap && hostSpeaking
                ? 'Tap an answer anytime — first tap stops the host and counts as an attempt.'
                : 'Shout a letter, or tap. Name-then-answer works too.'
              : earlyVoice
                ? 'Get ready — you can shout once the host starts reading.'
                : 'Hold answers until the host finishes the question.'}
        </Text>
      )}

      {settings.answerMode === 'buzz' && !buzzedPlayerId ? (
        <View style={styles.buzzRow}>
          {livePlayers
            .filter((p) => !p.isAi)
            .map((player) => (
              <View key={player.id} style={{ flex: 1 }}>
                <PrimaryButton
                  label={`${player.emoji} Buzz`}
                  variant="purple"
                  disabled={!acceptingTaps}
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

      {clickerOpen && pendingAnswer ? (
        <ClickerPanel
          pending={pendingAnswer}
          choiceLabel={current.choices[pendingAnswer.choiceIndex] ?? ''}
          players={livePlayers.filter((p) => !lockoutPlayerIds.includes(p.id))}
          who={clickerWho}
          correctOverride={clickerCorrect}
          onWho={setClickerWho}
          onCorrect={setClickerCorrect}
          onConfirm={confirmClicker}
        />
      ) : null}

      <View style={{ height: 12 }} />
      <HostBar
        line={listening ? `${hostLine} · listening` : hostLine}
        compact
        paused={paused}
        onHome={() => setLeaveOpen(true)}
        onPause={paused ? resumeRound : pauseRound}
        onRepeat={repeatQuestion}
        onSkip={skipQuestion}
        onSettings={() => setSettingsOpen(true)}
      />
      {transcript ? <Text style={styles.heard}>Heard: {transcript}</Text> : null}
      <HostControls
        paused={paused}
        hostSpeaking={hostSpeaking}
        showTtsRecovery={showTtsRecovery}
        onPause={pauseRound}
        onResume={resumeRound}
        onRepeat={repeatQuestion}
        onSkip={skipQuestion}
        onReveal={revealAnswer}
        onIdentify={identifyPlayer}
        onSave={saveGameNow}
        onStopSpeaking={stopHostSpeaking}
        onRetryTts={retryHostSpeech}
        onSkipToListening={skipToListening}
      />
      <View style={{ height: 10 }} />
      {settings.voiceEnabled ? (
        <PrimaryButton
          label={listening ? 'Listening…' : 'Listen now'}
          disabled={!acceptingVoice}
          onPress={listenNow}
        />
      ) : null}
      <View style={{ height: 8 }} />
      <PrimaryButton label="🏠 Home" variant="ghost" onPress={() => setLeaveOpen(true)} />
      <EventLogPanel events={eventLog} />

      <WhoSaidThatModal
        visible={Boolean(whoSaidThat) && !clickerOpen}
        transcript={whoSaidThat?.transcript ?? ''}
        choiceIndex={whoSaidThat?.choiceIndex ?? 0}
        choiceLabel={current.choices[whoSaidThat?.choiceIndex ?? 0] ?? ''}
        players={livePlayers.filter((p) => !lockoutPlayerIds.includes(p.id) || p.isAi)}
        onClaim={claimAnswer}
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
      <Modal visible={settingsOpen} transparent animationType="fade">
        <View style={styles.settingsBackdrop}>
          <View style={styles.settingsCard}>
            <Text style={styles.alertTitle}>IN-GAME SETTINGS</Text>
            <Text style={styles.alertBody}>
              Win: {settings.winCondition ?? 'QUESTION_LIMIT'}
              {settings.winCondition === 'POINT_TARGET'
                ? ` · first to ${settings.pointTarget ?? 500}`
                : ` · after ${questionTotal} questions`}
            </Text>
            <Text style={styles.settingsLabel}>HOST PERSONALITY</Text>
            <ChipSelect<HostPersonality>
              value={settings.hostPersonality ?? 'FUNNY'}
              onChange={(hostPersonality) => patchSettings({ hostPersonality })}
              options={[
                { value: 'CHILL', label: 'CHILL' },
                { value: 'FUNNY', label: 'FUNNY' },
                { value: 'COMPETITIVE', label: 'COMPETITIVE' },
                { value: 'SASSY', label: 'SASSY' },
                { value: 'SAVAGE', label: 'SAVAGE' },
              ]}
            />
            <View style={{ height: 12 }} />
            <PrimaryButton label="Close" variant="ghost" onPress={() => setSettingsOpen(false)} />
          </View>
        </View>
      </Modal>
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
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
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
  alert: {
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.panel,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  alertTitle: {
    color: colors.gold,
    fontWeight: '900',
    letterSpacing: 1.2,
    fontSize: 14,
  },
  alertBody: {
    color: colors.white,
    marginTop: 4,
    fontWeight: '700',
    lineHeight: 18,
  },
  settingsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7,17,31,0.82)',
    justifyContent: 'center',
    padding: 20,
  },
  settingsCard: {
    backgroundColor: colors.panel,
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
  },
  settingsLabel: {
    color: colors.muted,
    letterSpacing: 1.4,
    fontWeight: '800',
    fontSize: 12,
    marginTop: 14,
    marginBottom: 8,
  },
});
