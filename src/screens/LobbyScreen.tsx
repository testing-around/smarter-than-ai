import { StyleSheet, Text, View } from 'react-native';
import { AiHostOrb } from '../components/AiHostOrb';
import { HostBar } from '../components/HostBar';
import { Panel } from '../components/Panel';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { useGame } from '../context/GameContext';
import { profileForPlayer } from '../services/voiceProfiles';
import { colors } from '../theme/colors';

const MODE_LABEL = {
  shout: 'Shout out',
  buzz: 'Buzz-in',
  turn: 'Turn based',
} as const;

const HOST_MODE_LABEL = {
  FULL_AI_HOST: 'Full AI host',
  AI_HOST_PLUS_HUMAN_CLICKER: 'Host + clicker',
  HUMAN_HOST_PLUS_AI_ASSIST: 'Human host + AI assist',
} as const;

export function LobbyScreen() {
  const { players, settings, hostLine, startMatch, goSetup, voice, voiceProfiles } = useGame();

  return (
    <Screen>
      <Text style={styles.kicker}>LOBBY</Text>
      <Text style={styles.title}>Lights up</Text>
      <AiHostOrb caption="READY" />
      <HostBar line={hostLine} />
      <View style={{ height: 14 }} />
      <Panel>
        {players.map((player) => (
          <View key={player.id} style={styles.row}>
            <Text style={styles.emoji}>{player.emoji}</Text>
            <Text style={styles.name}>{player.name}</Text>
            <Text style={styles.meta}>
              {player.isAi
                ? 'CPU'
                : player.tapOnly
                  ? 'tap only'
                  : player.voiceReady
                    ? profileForPlayer(voiceProfiles, player.id)?.offlineReady
                      ? 'offline ready'
                      : 'voice ready'
                    : 'not trained'}
            </Text>
          </View>
        ))}
      </Panel>
      <View style={{ height: 12 }} />
      <Panel>
        <Text style={styles.rule}>
          {settings.questionCount} questions · {MODE_LABEL[settings.answerMode]} ·{' '}
          {settings.difficulty.toUpperCase()} · {settings.timerSeconds}s
        </Text>
        <Text style={styles.rule}>
          Last question is a BOSS ROUND (3×). Voice:{' '}
          {voice.available && settings.voiceEnabled ? 'on' : 'tap fallback'}. Host:{' '}
          {HOST_MODE_LABEL[settings.hostMode ?? 'AI_HOST_PLUS_HUMAN_CLICKER']}.
          {settings.answerMode === 'shout' && settings.earlyTapIn !== false
            ? ' Tap while the host reads.'
            : ''}
          {settings.earlyShoutOut && settings.answerMode === 'shout'
            ? ' Early shout-out: interrupt the host, wrong stays live.'
            : ''}
        </Text>
      </Panel>
      <View style={{ height: 18 }} />
      <PrimaryButton label="Start game" variant="gold" onPress={startMatch} />
      <View style={{ height: 10 }} />
      <PrimaryButton label="Edit setup" variant="ghost" onPress={goSetup} />
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
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  emoji: {
    fontSize: 22,
    width: 28,
  },
  name: {
    color: colors.white,
    fontWeight: '800',
    flex: 1,
    fontSize: 18,
  },
  meta: {
    color: colors.muted,
    fontWeight: '700',
  },
  rule: {
    color: colors.muted,
    lineHeight: 20,
  },
});
