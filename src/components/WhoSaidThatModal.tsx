import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, letters } from '../theme/colors';
import type { Player } from '../types';
import { PrimaryButton } from './PrimaryButton';

interface Props {
  visible: boolean;
  transcript: string;
  choiceIndex: number;
  choiceLabel: string;
  players: Player[];
  onClaim: (playerId: string) => void;
}

export function WhoSaidThatModal({
  visible,
  transcript,
  choiceIndex,
  choiceLabel,
  players,
  onClaim,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.kicker}>LOW SPEAKER CONFIDENCE</Text>
          <Text style={styles.title}>Who said that?</Text>
          <Text style={styles.body}>
            The host heard an answer and will not throw it away. Claim it.
          </Text>
          <View style={styles.heard}>
            <Text style={styles.heardLabel}>
              Heard {letters[choiceIndex]} — {choiceLabel}
            </Text>
            {transcript ? <Text style={styles.transcript}>“{transcript}”</Text> : null}
          </View>
          <View style={styles.claims}>
            {players
              .filter((p) => !p.isAi)
              .map((player) => (
                <Pressable
                  key={player.id}
                  onPress={() => onClaim(player.id)}
                  style={styles.claim}
                >
                  <Text style={styles.emoji}>{player.emoji}</Text>
                  <Text style={styles.name}>{player.name}</Text>
                </Pressable>
              ))}
          </View>
          <PrimaryButton
            label="It was me — first human"
            variant="ghost"
            onPress={() => {
              const first = players.find((p) => !p.isAi);
              if (first) {
                onClaim(first.id);
              }
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7,17,31,0.82)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    gap: 12,
  },
  kicker: {
    color: colors.gold,
    letterSpacing: 2,
    fontWeight: '800',
    fontSize: 11,
  },
  title: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '900',
  },
  body: {
    color: colors.muted,
    lineHeight: 20,
  },
  heard: {
    backgroundColor: colors.panel2,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  heardLabel: {
    color: colors.cyan,
    fontWeight: '800',
  },
  transcript: {
    color: colors.white,
  },
  claims: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  claim: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.panel2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  emoji: {
    fontSize: 18,
  },
  name: {
    color: colors.white,
    fontWeight: '700',
  },
});
