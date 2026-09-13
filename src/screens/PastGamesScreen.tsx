import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Panel } from '../components/Panel';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { useGame } from '../context/GameContext';
import { colors } from '../theme/colors';

export function PastGamesScreen() {
  const {
    sessionSummaries,
    continueSavedGame,
    renameSavedGame,
    deleteSavedGame,
    goHome,
  } = useGame();
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <Screen>
      <Text style={styles.kicker}>LIBRARY</Text>
      <Text style={styles.title}>Past games</Text>
      <Text style={styles.sub}>Resume an unfinished match or tidy completed nights.</Text>
      {sessionSummaries.length === 0 ? (
        <Panel>
          <Text style={styles.empty}>No saved games yet.</Text>
        </Panel>
      ) : (
        sessionSummaries.map((row) => (
          <Panel key={row.id}>
            <Text style={styles.name}>{row.name}</Text>
            <Text style={styles.meta}>
              {row.status === 'in_progress' ? 'In progress' : 'Completed'} · Q{' '}
              {row.questionNumber}/{row.questionTotal} · {row.playerNames.join(', ')}
            </Text>
            {renameId === row.id ? (
              <View style={styles.renameRow}>
                <TextInput
                  value={renameValue}
                  onChangeText={setRenameValue}
                  style={styles.input}
                  placeholder="Game name"
                  placeholderTextColor={colors.muted}
                />
                <PrimaryButton
                  label="Save name"
                  onPress={() => {
                    renameSavedGame(row.id, renameValue);
                    setRenameId(null);
                  }}
                />
              </View>
            ) : null}
            <View style={styles.row}>
              {row.status === 'in_progress' ? (
                <View style={styles.cell}>
                  <PrimaryButton
                    label="Continue"
                    variant="gold"
                    onPress={() => continueSavedGame(row.id)}
                  />
                </View>
              ) : null}
              <View style={styles.cell}>
                <PrimaryButton
                  label="Rename"
                  variant="ghost"
                  onPress={() => {
                    setRenameId(row.id);
                    setRenameValue(row.name);
                  }}
                />
              </View>
              <View style={styles.cell}>
                <PrimaryButton
                  label={deleteId === row.id ? 'Confirm delete' : 'Delete'}
                  variant="ghost"
                  onPress={() => {
                    if (deleteId === row.id) {
                      deleteSavedGame(row.id);
                      setDeleteId(null);
                      return;
                    }
                    setDeleteId(row.id);
                  }}
                />
              </View>
            </View>
          </Panel>
        ))
      )}
      <View style={{ height: 16 }} />
      <PrimaryButton label="Back home" variant="ghost" onPress={goHome} />
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
  empty: {
    color: colors.muted,
  },
  name: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 16,
  },
  meta: {
    color: colors.muted,
    marginTop: 4,
    marginBottom: 10,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  cell: {
    flex: 1,
  },
  renameRow: {
    gap: 8,
    marginBottom: 10,
  },
  input: {
    color: colors.white,
    backgroundColor: colors.panel2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: '700',
  },
});
