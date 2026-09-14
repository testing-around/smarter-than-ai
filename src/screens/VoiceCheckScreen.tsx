import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Panel } from '../components/Panel';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { useGame } from '../context/GameContext';
import {
  PHRASES_REQUIRED,
  classifySampleQuality,
  enrollmentPhrases,
  sampleIsValid,
  scorePhraseMatch,
  voiceProfileStatus,
} from '../game/enrollmentMachine';
import type { EnrollmentSample } from '../types';
import { guessSpeaker, shouldAskWhoSaidThat } from '../services/speakerMatch';
import {
  cancelListening,
  captureEnrollmentSample,
  formatDiagnosticsText,
  getVoiceDiagnostics,
  isRecognizerBusy,
} from '../services/voice';
import { profileForPlayer } from '../services/voiceProfiles';
import { colors } from '../theme/colors';

export function VoiceCheckScreen() {
  const {
    players,
    voice,
    voiceProfiles,
    completeVoiceEnrollment,
    deleteVoiceProfile,
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
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [testLine, setTestLine] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);

  const humans = players.filter((player) => !player.isAi);
  const training = humans.find((player) => player.id === trainingId) ?? null;
  const phrases = useMemo(
    () => (training ? enrollmentPhrases(training.name) : []),
    [training],
  );
  const currentPhrase = phrases[phraseIndex] ?? null;
  const passedCount = samples.filter((sample) => sampleIsValid(sample)).length;
  const allSettled = humans.every((player) => player.voiceReady || player.tapOnly);
  const busy = listening || Boolean(testingId);

  const resetTrain = () => {
    if (isRecognizerBusy()) {
      void cancelListening('cancel-training');
    }
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
    setTestLine('');
    setTrainingId(id);
    setPhraseIndex(0);
    setSamples([]);
    setHeard('');
    setError('');
    setLastScore(null);
  };

  const capturePhrase = async () => {
    if (!training || !currentPhrase || busy) {
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
      12000,
      {
        speakPrompt: currentPhrase.prompt,
        screen: 'VOICE_CHECK',
        playerId: training.id,
        phrase: currentPhrase.id,
      },
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
      audioUri: null,
      matchScore,
      capturedAt: Date.now(),
      embedding: capture.embedding,
      speechDetected: capture.speechDetected,
    };
    sample.quality = classifySampleQuality(sample);
    setHeard(capture.transcript);
    setLastScore(matchScore);
    if (!sampleIsValid(sample)) {
      const why =
        sample.quality === 'too-short'
          ? 'That was too short. Speak the full line for about two to five seconds.'
          : sample.quality === 'silence'
            ? 'That sounded like silence. Try again closer to the phone.'
            : sample.quality === 'too-long'
              ? 'That ran long. Say just the prompt, then stop.'
              : 'That did not match the prompt. Retry the same line.';
      setError(why);
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

  const testVoice = async (playerId: string) => {
    if (busy) {
      return;
    }
    const player = humans.find((item) => item.id === playerId);
    if (!player) {
      return;
    }
    setTestingId(playerId);
    setTestLine('Listen after the host…');
    const capture = await captureEnrollmentSample(
      [player.name, 'A', 'B', 'C', 'D', 'yes', 'no'],
      10000,
      {
        speakPrompt: `${player.name}, say a full sentence in your normal voice.`,
        screen: 'VOICE_CHECK',
        playerId,
        phrase: 'test',
      },
    );
    setTestingId(null);
    if (!capture.ok) {
      setTestLine(capture.error ?? 'Test failed. Try again.');
      return;
    }
    const guess = guessSpeaker(
      capture.transcript,
      capture.durationMs,
      players,
      voiceProfiles,
      capture.embedding,
    );
    if (shouldAskWhoSaidThat(guess)) {
      setTestLine(
        `Heard “${capture.transcript}”. Uncertain — Who said that? (calibrated ${Math.round(guess.confidence * 100)}%${guess.margin != null ? `, margin ${guess.margin.toFixed(2)}` : ''})`,
      );
      return;
    }
    const who = players.find((item) => item.id === guess.playerId);
    setTestLine(
      `Heard “${capture.transcript}” as ${who?.name ?? 'a player'} · calibrated ${Math.round(guess.confidence * 100)}%`,
    );
  };

  const enterLobby = () => {
    setLobbyError('');
    if (settings.voiceEnabled && voice.available && !allSettled) {
      setLobbyError('Train each player (or mark tap-only) before entering the lobby.');
      return;
    }
    finishVoiceCheck();
  };

  const statusFor = (playerId: string, voiceReady?: boolean, tapOnly?: boolean) => {
    const saved = profileForPlayer(voiceProfiles, playerId);
    if (tapOnly) {
      return 'TAP ONLY';
    }
    if (voiceReady || saved?.quality.voiceReady) {
      return saved?.offlineReady ? 'TRAINED · Offline READY' : 'TRAINED';
    }
    return voiceProfileStatus(saved);
  };

  return (
    <Screen>
      <Text style={styles.kicker}>VOICE CHECK</Text>
      <Pressable onLongPress={() => setDiagnosticsOpen(true)} delayLongPress={450}>
        <Text style={styles.title}>Train each voice</Text>
      </Pressable>
      <Text style={styles.sub}>
        Each player says {phrases.length || 5} lines (about 2–5 seconds). We store a speaker
        profile on this device only so the game can guess who spoke after airplane mode — the
        speech engine does not learn voices. Need {PHRASES_REQUIRED} good samples (5 is better).
        Uncertain matches still ask “Who said that?”
      </Text>

      <Panel>
        <Text style={styles.voiceTitle}>{voice.available ? 'Mic path ready' : 'Tap-only fallback'}</Text>
        <Text style={styles.voiceDetail}>{voice.detail}</Text>
        <Text style={styles.voiceDetail}>
          On-device STT: {voice.onDevice ? 'supported' : 'unknown'} · English pack:{' '}
          {voice.offlineEnUs ? 'detected' : 'not detected'} · Recording:{' '}
          {voice.recording ? 'yes' : 'no'}
        </Text>
      </Panel>

      {training && currentPhrase ? (
        <Panel gold>
          <Text style={styles.player}>
            {training.emoji} Training {training.name}
          </Text>
          <Text style={styles.progress}>
            Phrase {phraseIndex + 1}/{phrases.length} · {passedCount} passed (need {PHRASES_REQUIRED})
          </Text>
          <Text style={styles.mic}>🎤 SAY THIS AFTER THE HOST</Text>
          <Text style={styles.prompt}>“{currentPhrase.prompt}”</Text>
          {listening ? (
            <>
              <ActivityIndicator color={colors.cyan} style={{ marginVertical: 12 }} />
              <PrimaryButton
                label="Cancel listen"
                variant="ghost"
                onPress={() => void cancelListening('user-cancel')}
              />
            </>
          ) : (
            <PrimaryButton
              label="I'm ready — listen"
              onPress={() => void capturePhrase()}
              disabled={busy}
            />
          )}
          <View style={{ height: 8 }} />
          <PrimaryButton
            label="Retry this phrase"
            variant="ghost"
            onPress={() => void capturePhrase()}
            disabled={busy}
          />
          <View style={{ height: 8 }} />
          {passedCount >= PHRASES_REQUIRED ? (
            <PrimaryButton
              label="That's enough — save profile"
              variant="gold"
              disabled={busy}
              onPress={() => {
                const saved = completeVoiceEnrollment(training.id, training.name, samples);
                if (saved.quality.voiceReady) {
                  resetTrain();
                }
              }}
            />
          ) : null}
          <View style={{ height: 8 }} />
          <PrimaryButton label="Cancel training" variant="ghost" onPress={resetTrain} disabled={listening} />
          {heard ? (
            <Text style={styles.heard}>
              Heard: “{heard}”{lastScore !== null ? ` · match ${Math.round(lastScore * 100)}%` : ''}
            </Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {error ? (
            <View style={{ marginTop: 8 }}>
              <PrimaryButton label="Try again" onPress={() => void capturePhrase()} disabled={busy} />
              <View style={{ height: 8 }} />
              <PrimaryButton
                label="Diagnostics"
                variant="ghost"
                onPress={() => setDiagnosticsOpen(true)}
              />
              <View style={{ height: 8 }} />
              <PrimaryButton
                label="Tap-only for this player"
                variant="ghost"
                onPress={() => {
                  skipPlayerVoice(training.id);
                  resetTrain();
                }}
              />
            </View>
          ) : null}
        </Panel>
      ) : (
        humans.map((player) => {
          const saved = profileForPlayer(voiceProfiles, player.id);
          const savedReady = Boolean(saved?.quality.voiceReady);
          const badge = statusFor(player.id, player.voiceReady, player.tapOnly);
          return (
            <Panel key={player.id} gold={Boolean(player.voiceReady)}>
              <Text style={styles.player}>
                {player.emoji} {player.name}
              </Text>
              <Text style={styles.badge}>{badge}</Text>
              <Text style={styles.phrase}>
                {savedReady
                  ? `${saved?.samplesAccepted ?? saved?.quality.phrasesPassed ?? PHRASES_REQUIRED} samples stored locally on this device`
                  : `Train with ${enrollmentPhrases(player.name).length} spoken lines`}
              </Text>
              <View style={{ height: 10 }} />
              <PrimaryButton
                label={
                  voice.available
                    ? player.voiceReady || savedReady
                      ? 'Retrain voice'
                      : 'Train voice'
                    : 'Mic unavailable'
                }
                onPress={() => startTrain(player.id)}
                disabled={!voice.available || busy}
              />
              {savedReady ? (
                <>
                  <View style={{ height: 8 }} />
                  <PrimaryButton
                    label="Test my voice"
                    variant="ghost"
                    onPress={() => void testVoice(player.id)}
                    disabled={!voice.available || busy}
                  />
                  <View style={{ height: 8 }} />
                  <PrimaryButton
                    label="Delete voice profile"
                    variant="danger"
                    onPress={() => {
                      deleteVoiceProfile(player.id);
                      setTestLine('');
                    }}
                    disabled={busy}
                  />
                </>
              ) : null}
              {savedReady && !player.voiceReady ? (
                <>
                  <View style={{ height: 8 }} />
                  <PrimaryButton
                    label="Use saved profile"
                    variant="ghost"
                    onPress={() => useSaved(player.id)}
                    disabled={busy}
                  />
                </>
              ) : null}
              <View style={{ height: 8 }} />
              <PrimaryButton
                label="Skip this player — tap only"
                variant="ghost"
                onPress={() => skipPlayerVoice(player.id)}
                disabled={busy}
              />
            </Panel>
          );
        })
      )}

      {testLine ? <Text style={styles.heard}>{testLine}</Text> : null}
      {lobbyError ? <Text style={styles.error}>{lobbyError}</Text> : null}

      <View style={{ height: 16 }} />
      <PrimaryButton
        label="Enter lobby"
        onPress={enterLobby}
        disabled={Boolean(trainingId) || busy}
      />
      <View style={{ height: 10 }} />
      <PrimaryButton
        label="Skip all voice — tap only"
        variant="ghost"
        onPress={skipVoiceAndLobby}
        disabled={busy}
      />
      <View style={{ height: 10 }} />
      <PrimaryButton label="Back to setup" variant="ghost" onPress={goSetup} disabled={busy} />

      <Modal visible={diagnosticsOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.voiceTitle}>Voice diagnostics</Text>
            <Text style={styles.diag}>{formatDiagnosticsText(getVoiceDiagnostics())}</Text>
            <View style={{ height: 12 }} />
            <PrimaryButton label="Close" onPress={() => setDiagnosticsOpen(false)} />
          </View>
        </View>
      </Modal>
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
    marginBottom: 4,
  },
  player: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 18,
  },
  badge: {
    color: colors.gold,
    fontWeight: '800',
    marginTop: 4,
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
  diag: {
    color: colors.muted,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    maxHeight: '80%',
  },
});
