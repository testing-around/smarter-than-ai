import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChipSelect } from '../components/ChipSelect';
import { Panel } from '../components/Panel';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { useGame } from '../context/GameContext';
import { PLAYER_EMOJIS } from '../data/players';
import { colors } from '../theme/colors';
import type { AnswerMode, GameDifficulty, QuestionCount } from '../types';

export function SetupScreen() {
  const {
    players,
    settings,
    setPlayerName,
    setPlayerEmoji,
    addPlayer,
    removePlayer,
    loadFamily,
    patchSettings,
    continueToVoiceCheck,
    goHome,
  } = useGame();

  return (
    <Screen>
      <Text style={styles.kicker}>SETUP</Text>
      <Text style={styles.title}>Name the contestants</Text>
      <Text style={styles.sub}>Default family trio is ready. Add friends, then pick the rules.</Text>

      {players
        .filter((p) => !p.isAi)
        .map((player) => (
          <Panel key={player.id}>
            <View style={styles.playerHead}>
              <Text style={styles.emoji}>{player.emoji}</Text>
              <TextInput
                value={player.name}
                onChangeText={(name) => setPlayerName(player.id, name)}
                placeholder="Player name"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              {players.filter((p) => !p.isAi).length > 1 ? (
                <Pressable onPress={() => removePlayer(player.id)}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.emojis}>
              {PLAYER_EMOJIS.map((emoji) => (
                <Pressable key={emoji} onPress={() => setPlayerEmoji(player.id, emoji)}>
                  <Text style={[styles.pick, player.emoji === emoji && styles.pickOn]}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          </Panel>
        ))}

      <View style={styles.rowBtns}>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="Add player" variant="ghost" onPress={addPlayer} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="Load Damian / Dorian / Delissa" variant="ghost" onPress={loadFamily} />
        </View>
      </View>

      <Text style={styles.section}>QUESTIONS</Text>
      <ChipSelect<QuestionCount>
        value={settings.questionCount}
        onChange={(questionCount) => patchSettings({ questionCount })}
        options={[
          { value: 5, label: '5' },
          { value: 10, label: '10' },
          { value: 20, label: '20' },
        ]}
      />

      <Text style={styles.section}>ANSWER MODE</Text>
      <ChipSelect<AnswerMode>
        value={settings.answerMode}
        onChange={(answerMode) => patchSettings({ answerMode })}
        options={[
          { value: 'shout', label: 'SHOUT OUT' },
          { value: 'buzz', label: 'BUZZ-IN' },
          { value: 'turn', label: 'TURN BASED' },
        ]}
      />

      <Text style={styles.section}>DIFFICULTY</Text>
      <ChipSelect<GameDifficulty>
        value={settings.difficulty}
        onChange={(difficulty) => patchSettings({ difficulty })}
        options={[
          { value: 'easy', label: 'EASY' },
          { value: 'adaptive', label: 'ADAPTIVE' },
          { value: 'hard', label: 'HARD' },
        ]}
      />

      <Text style={styles.section}>TIMER</Text>
      <ChipSelect<number>
        value={settings.timerSeconds}
        onChange={(timerSeconds) => patchSettings({ timerSeconds })}
        options={[
          { value: 8, label: '8s' },
          { value: 12, label: '12s' },
          { value: 15, label: '15s' },
          { value: 20, label: '20s' },
        ]}
      />

      <Pressable
        onPress={() => patchSettings({ beatTheAi: !settings.beatTheAi })}
        style={[styles.toggle, settings.beatTheAi && styles.toggleOn]}
      >
        <Text style={styles.toggleText}>
          {settings.beatTheAi ? '🤖 Beat the AI is ON' : '🤖 Beat the AI is OFF'}
        </Text>
      </Pressable>

      <Panel>
        <Text style={styles.infoTitle}>Voice-first night</Text>
        <Text style={styles.info}>
          Shout the letter, or say a name then the answer (“Damian, B”). If the host is not sure
          who spoke, it asks “Who said that?” — the answer is never thrown away.
        </Text>
      </Panel>

      <View style={{ height: 16 }} />
      <PrimaryButton label="Continue to voice check" onPress={continueToVoiceCheck} />
      <View style={{ height: 10 }} />
      <PrimaryButton label="Back" variant="ghost" onPress={goHome} />
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
  playerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  emoji: {
    fontSize: 28,
  },
  input: {
    flex: 1,
    color: colors.white,
    backgroundColor: colors.panel2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
  },
  remove: {
    color: colors.red,
    fontWeight: '700',
  },
  emojis: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pick: {
    fontSize: 22,
    opacity: 0.45,
  },
  pickOn: {
    opacity: 1,
  },
  rowBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  section: {
    color: colors.muted,
    letterSpacing: 2,
    fontWeight: '800',
    fontSize: 12,
    marginTop: 20,
    marginBottom: 8,
  },
  toggle: {
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleOn: {
    borderColor: colors.cyan,
    backgroundColor: colors.panel2,
  },
  toggleText: {
    color: colors.white,
    fontWeight: '700',
  },
  infoTitle: {
    color: colors.gold,
    fontWeight: '800',
    marginBottom: 6,
  },
  info: {
    color: colors.muted,
    lineHeight: 20,
  },
});
