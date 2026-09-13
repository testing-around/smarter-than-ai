import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Panel } from '../components/Panel';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { useGame } from '../context/GameContext';
import { enrollmentPhrase, transcriptMatchesEnrollment } from '../services/speechParser';
import { listenOnce, requestVoicePermissions } from '../services/voice';
import { colors } from '../theme/colors';

export function VoiceCheckScreen() {
  const {
    players,
    voice,
    enrollPlayer,
    skipVoiceAndLobby,
    finishVoiceCheck,
    goSetup,
    settings,
    patchSettings,
  } = useGame();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [heard, setHeard] = useState('');
  const [error, setError] = useState('');

  const humans = players.filter((p) => !p.isAi);

  const enrollWithMic = async (id: string, name: string) => {
    setError('');
    setHeard('');
    setBusyId(id);
    const permitted = await requestVoicePermissions();
    if (!permitted && !voice.available) {
      setError('Mic enrollment needs a device build with speech recognition. Mark enrolled by tap.');
      setBusyId(null);
      return;
    }
    const text = await listenOnce([name, 'smarter', 'than', 'AI', 'ready'], 9000);
    setBusyId(null);
    if (!text) {
      setError('Did not catch a line. Try again closer to the phone, or mark enrolled.');
      return;
    }
    setHeard(text);
    if (transcriptMatchesEnrollment(text, name)) {
      enrollPlayer(id);
    } else {
      setError('Heard something, but not a clear enrollment. You can still mark it.');
    }
  };

  return (
    <Screen>
      <Text style={styles.kicker}>VOICE CHECK</Text>
      <Text style={styles.title}>Enroll each player</Text>
      <Text style={styles.sub}>
        Practical party enrollment: say your name on the phrase below. This is not biometric speaker
        ID. The live game matches names in the transcript, then asks “Who said that?” if unsure.
      </Text>

      <Panel>
        <Text style={styles.voiceTitle}>{voice.available ? 'Mic path ready' : 'Tap-only fallback'}</Text>
        <Text style={styles.voiceDetail}>{voice.detail}</Text>
      </Panel>

      {humans.map((player) => (
        <Panel key={player.id} gold={player.enrolled}>
          <Text style={styles.player}>
            {player.emoji} {player.name} {player.enrolled ? '· enrolled' : ''}
          </Text>
          <Text style={styles.phrase}>Say: “{enrollmentPhrase(player.name)}”</Text>
          <View style={{ height: 10 }} />
          {busyId === player.id ? (
            <ActivityIndicator color={colors.cyan} />
          ) : (
            <PrimaryButton
              label={voice.available ? 'Enroll with mic' : 'Mic unavailable'}
              onPress={() => void enrollWithMic(player.id, player.name)}
              disabled={!voice.available}
            />
          )}
          <View style={{ height: 8 }} />
          <PrimaryButton
            label="Mark enrolled"
            variant="ghost"
            onPress={() => enrollPlayer(player.id)}
          />
        </Panel>
      ))}

      {heard ? <Text style={styles.heard}>Last heard: “{heard}”</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={{ height: 16 }} />
      <PrimaryButton
        label="Enter lobby"
        onPress={() => {
          patchSettings({ voiceEnabled: settings.voiceEnabled && voice.available });
          finishVoiceCheck();
        }}
      />
      <View style={{ height: 10 }} />
      <PrimaryButton label="Skip voice — tap only" variant="ghost" onPress={skipVoiceAndLobby} />
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
