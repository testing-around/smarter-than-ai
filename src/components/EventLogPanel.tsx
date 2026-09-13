import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatEventLine } from '../services/gameEventLog';
import { colors } from '../theme/colors';
import type { GameEvent } from '../types';

export function EventLogPanel({ events }: { events: GameEvent[] }) {
  const [open, setOpen] = useState(false);
  const shown = events.slice(-8).reverse();

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen((prev) => !prev)}>
        <Text style={styles.toggle}>{open ? 'Hide event log' : 'Show event log'}</Text>
      </Pressable>
      {open
        ? shown.map((event, index) => (
            <Text key={`${event.at}-${event.type}-${index}`} style={styles.line}>
              {formatEventLine(event)}
            </Text>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    gap: 3,
  },
  toggle: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
  },
  line: {
    color: colors.muted,
    fontSize: 10,
    fontFamily: 'monospace',
  },
});
