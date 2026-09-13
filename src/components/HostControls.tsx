import { StyleSheet, View } from 'react-native';
import { PrimaryButton } from './PrimaryButton';

interface Props {
  paused: boolean;
  hostSpeaking: boolean;
  showTtsRecovery: boolean;
  onPause: () => void;
  onResume: () => void;
  onRepeat: () => void;
  onSkip: () => void;
  onReveal: () => void;
  onIdentify: () => void;
  onSave: () => void;
  onStopSpeaking: () => void;
  onRetryTts: () => void;
  onSkipToListening: () => void;
}

export function HostControls({
  paused,
  hostSpeaking,
  showTtsRecovery,
  onPause,
  onResume,
  onRepeat,
  onSkip,
  onReveal,
  onIdentify,
  onSave,
  onStopSpeaking,
  onRetryTts,
  onSkipToListening,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {paused ? (
          <View style={styles.cell}>
            <PrimaryButton label="Resume" variant="gold" onPress={onResume} />
          </View>
        ) : (
          <View style={styles.cell}>
            <PrimaryButton label="Pause" variant="ghost" onPress={onPause} />
          </View>
        )}
        <View style={styles.cell}>
          <PrimaryButton label="Repeat" variant="ghost" onPress={onRepeat} />
        </View>
        <View style={styles.cell}>
          <PrimaryButton label="Skip" variant="ghost" onPress={onSkip} />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.cell}>
          <PrimaryButton label="Identify player" variant="ghost" onPress={onIdentify} />
        </View>
        <View style={styles.cell}>
          <PrimaryButton label="Reveal answer" variant="ghost" onPress={onReveal} />
        </View>
        <View style={styles.cell}>
          <PrimaryButton label="Save" variant="ghost" onPress={onSave} />
        </View>
      </View>
      {hostSpeaking ? (
        <PrimaryButton label="Stop host speaking" variant="danger" onPress={onStopSpeaking} />
      ) : null}
      {showTtsRecovery ? (
        <View style={styles.row}>
          <View style={styles.cell}>
            <PrimaryButton label="Retry host voice" variant="ghost" onPress={onRetryTts} />
          </View>
          <View style={styles.cell}>
            <PrimaryButton label="I read it — listen" variant="purple" onPress={onSkipToListening} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  cell: {
    flex: 1,
  },
});
