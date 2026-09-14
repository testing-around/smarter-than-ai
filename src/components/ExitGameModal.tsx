import { Modal, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { PrimaryButton } from './PrimaryButton';

interface Props {
  visible: boolean;
  onSaveAndExit: () => void;
  onExit: () => void;
  onCancel: () => void;
}

export function ExitGameModal({ visible, onSaveAndExit, onExit, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.kicker}>LEAVE GAME</Text>
          <Text style={styles.title}>Head home?</Text>
          <Text style={styles.body}>
            Save & Exit keeps this match so you can continue later. Exit abandons it.
          </Text>
          <PrimaryButton label="Save & Exit" variant="gold" onPress={onSaveAndExit} />
          <PrimaryButton label="Exit" variant="danger" onPress={onExit} />
          <PrimaryButton label="Cancel" variant="ghost" onPress={onCancel} />
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
    gap: 10,
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
    marginBottom: 6,
  },
});
