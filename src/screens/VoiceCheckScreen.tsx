import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Panel } from '../components/Panel';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { useGame } from '../context/GameContext';
import {
  PHRASES_REQUIRED,
  enrollmentPhrases,
  phrasePassed,
  scorePhraseMatch,
} from '../game/enrollmentMachine';
import type { EnrollmentSample } from '../types';
import { captureEnrollmentSample } from '../services/voice';
import { profileForPlayer } from '../services/voiceProfiles';
import { colors } from '../theme/colors';

export function VoiceCheckScreen() {
  const {
    players,
    voice,
    voiceProfiles,
    completeVoiceEnrollment,
    skipPlayerVoice,
    skipVoiceAndLobby,
    finishVoiceCheck,
    goSetup,
    settings,
  } = useGame();

  const [trainingId, setTrainingId] = useState<string | null>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [samples, setSamples] = useState<EnrollmentSample[]>([]);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [error, setError] = useState('');
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [lobbyError, setLobbyError] = useState('');

  const humans = players.filter((player) => !player.isAi);
  const training = humans.find((player) => player.id === trainingId) ?? null;
  const phrases = useMemo(
    () => (training ? enrollmentPhrases(training.name) : []),
    [training],
  );
  const currentPhrase = phrases[phraseIndex] ?? null;
  const passedCount = samples.filter((sample) => phrasePassed(sample.matchScore)).length;
  const allSettled = humans.every((player) => player.voiceReady || player.tapOnly);

  const resetTrain = () => {
    setTrainingId(null);
    setPhraseIndex(0);
    setSamples([]);
    setListening(false);
    setHeard('');
    setError('');
    setLastScore(null);
  };

  const startTrain = (id: string) => {
    setLobbyError('');
    setTrainingId(id);
    setPhraseIndex(0);
    setSamples([]);
    setHeard('');
    setError('');
    setLastScore(null);
  };

  const capturePhrase = async () => {
    if (!training || !currentPhrase) {
      return;
    }
    if (!voice.available) {
      setError('Speech recognition is not available on this device. Skip to tap-only, or use a standalone APK.');
      return;
    }
    setError('');
    setHeard('');
    setLastScore(null);
    setListening(true);
    const capture = await captureEnrollmentSample(
      [training.name, currentPhrase.prompt, 'yes', 'no', 'ready', 'answer'],
      10000,
    );
    setListening(false);
    if (!capture.ok) {
      setError(capture.error ?? 'Did not capture that phrase.');
      setHeard(capture.transcript);
      return;
    }
    const matchScore = scorePhraseMatch(capture.transcript, currentPhrase, training.name);
    const sample: EnrollmentSample = {
      phraseId: currentPhrase.id,
      prompt: currentPhrase.prompt,
      transcript: capture.transcript,
      durationMs: capture.durationMs,
      audioUri: capture.audioUri,
      matchScore,
      capturedAt: Date.now(),
    };
    setHeard(capture.transcript);
    setLastScore(matchScore);
    if (!phrasePassed(matchScore)) {
      setError('That did not match the prompt. Retry the same line.');
      return;
    }
    const nextSamples = [...samples.filter((item) => item.phraseId !== sample.phraseId), sample];
    setSamples(nextSamples);
    if (phraseIndex + 1 < phrases.length) {
      setPhraseIndex(phraseIndex + 1);
      setError('');
      return;
    }
    const saved = completeVoiceEnrollment(training.id, training.name, nextSamples);
    if (!saved.quality.voiceReady) {
      setError(`Need ${PHRASES_REQUIRED} good phrases. Keep going.`);
      return;
    }
    resetTrain();
  };

  const useSaved = (id: string) => {
    const profile = profileForPlayer(voiceProfiles, id);
    if (!profile?.quality.voiceReady) {
      return;
    }
    completeVoiceEnrollment(id, profile.name, profile.enrollmentSamples);
  };

  const enterLobby = () => {
    setLobbyError('');
    if (settings.voiceEnabled && voice.available && !allSettled) {
      setLobbyError('Train each player (or mark tap-only) before entering the lobby.');
      return;
    }
    finishVoiceCheck();
  };

  return (
    <Screen>
      <Text style={styles.kicker}>VOICE CHECK</Text>
      <Text style={styles.title}>Train each voice</Text>
      <Text style={styles.sub}>
        Each player says {phrases.length || 5} short lines so we can store a local session profile.
        This is not biometric ID. The game still asks “Who said that?” when confidence is under 70%.
      </Text>

      <Panel>
        <Text style={styles.voiceTitle}>{voice.available ? 'Mic path ready' : 'Tap-only fallback'}</Text>
        <Text style={styles.voiceDetail}>{voice.detail}</Text>
      </Panel>

      {training && currentPhrase ? (
        <Panel gold>
          <Text style={styles.player}>
            {training.emoji} Training {training.name}
          </Text>
          <Text style={styles.progress}>
            Phrase {phraseIndex + 1}/{phrases.length} · {passedCount} passed (need {PHRASES_REQUIRED})
          </Text>
          <Text style={styles.mic}>🎤 SAY THIS</Text>
          <Text style={styles.prompt}>“{currentPhrase.prompt}”</Text>
          {listening ? (
            <ActivityIndicator color={colors.cyan} style={{ marginVertical: 12 }} />
          ) : (
            <PrimaryButton label="I'm ready — listen" onPress={() => void capturePhrase()} />
          )}
          <View style={{ height: 8 }} />
          <PrimaryButton label="Retry this phrase" variant="ghost" onPress={() => void capturePhrase()} />
          <View style={{ height: 8 }} />
          {passedCount >= PHRASES_REQUIRED ? (
            <PrimaryButton
              label="That's enough — save profile"
              variant="gold"
              onPress={() => {
                const saved = completeVoiceEnrollment(training.id, training.name, samples);
                if (saved.quality.voiceReady) {
                  resetTrain();
                }
              }}
            />
          ) : null}
          <View style={{ height: 8 }} />
          <PrimaryButton label="Cancel training" variant="ghost" onPress={resetTrain} />
          {heard ? (
            <Text style={styles.heard}>
              Heard: “{heard}”{lastScore !== null ? ` · match ${Math.round(lastScore * 100)}%` : ''}
            </Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Panel>
      ) : (
        humans.map((player) => {
          const saved = profileForPlayer(voiceProfiles, player.id);
          const savedReady = Boolean(saved?.quality.voiceReady);
          return (
            <Panel key={player.id} gold={Boolean(player.voiceReady)}>
              <Text style={styles.player}>
                {player.emoji} {player.name}{' '}
                {player.voiceReady
                  ? '· voice ready'
                  : player.tapOnly
                    ? '· tap only'
                    : '· not trained'}
              </Text>
              <Text style={styles.phrase}>
                {player.voiceReady
                  ? `${saved?.quality.phrasesPassed ?? PHRASES_REQUIRED} phrases stored locally`
                  : `Train with ${enrollmentPhrases(player.name).length} short phrases`}
              </Text>
              <View style={{ height: 10 }} />
              <PrimaryButton
                label={voice.available ? 'Train voice' : 'Mic unavailable'}
                onPress={() => startTrain(player.id)}
                disabled={!voice.available}
              />
              {savedReady && !player.voiceReady ? (
                <>
                  <View style={{ height: 8 }} />
                  <PrimaryButton
                    label="Use saved samples"
                    variant="ghost"
                    onPress={() => useSaved(player.id)}
                  />
                </>
              ) : null}
              <View style={{ height: 8 }} />
              <PrimaryButton
                label="Skip this player — tap only"
                variant="ghost"
                onPress={() => skipPlayerVoice(player.id)}
              />
            </Panel>
          );
        })
      )}

      {lobbyError ? <Text style={styles.error}>{lobbyError}</Text> : null}

      <View style={{ height: 16 }} />
      <PrimaryButton
        label="Enter lobby"
        onPress={enterLobby}
        disabled={Boolean(trainingId)}
      />
      <View style={{ height: 10 }} />
      <PrimaryButton
        label="Skip all voice — tap only"
        variant="ghost"
        onPress={skipVoiceAndLobby}
      />
      <View style={{ height: 10 }} />
      <PrimaryButton label="Back to setup" variant="ghost" onPress={goSetup} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: colors.cyan,
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
  sub: {
    color: colors.muted,
    marginVertical: 10,
    lineHeight: 20,
  },
  voiceTitle: {
    color: colors.gold,
    fontWeight: '800',
    marginBottom: 6,
  },
  voiceDetail: {
    color: colors.muted,
    lineHeight: 20,
  },
  player: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 18,
  },
  progress: {
    color: colors.gold,
    fontWeight: '800',
    marginTop: 6,
  },
  mic: {
    color: colors.cyan,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 12,
    fontSize: 13,
  },
  prompt: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '800',
    marginVertical: 10,
    lineHeight: 28,
  },
  phrase: {
    color: colors.cyan,
    marginTop: 6,
  },
  heard: {
    color: colors.green,
    marginTop: 12,
  },
  error: {
    color: colors.red,
    marginTop: 8,
  },
});
